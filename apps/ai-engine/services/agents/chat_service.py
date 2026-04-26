from typing import List, Optional, Tuple
from uuid import uuid4

from beanie import PydanticObjectId
from beanie.operators import And, In, Or
from fastapi import HTTPException
from langchain_core.messages import (
    BaseMessage,
    SystemMessage,
    messages_to_dict,
    messages_from_dict,
)
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

from core.auth import AuthProvider
from core.backend_client import BackendClient
from models.chat import Chat, ChatMessage
from services.agents.checkpointers import get_mongo_checkpointer
from services.agents.llms import get_llm

from loguru import logger


# Projection model: fetch only message_id to avoid loading full data fields.
class _MessageIdProjection(BaseModel):
    message_id: str


class _ChatName(BaseModel):
    name: str


async def _generate_chat_name(message: str) -> str:
    """Use a fast LLM call to produce a short, descriptive chat name."""
    try:
        llm = get_llm().with_structured_output(_ChatName, strict=True)
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "Generate a concise chat title (max 6 words) that summarises "
                    "the user's request. Reply with only the title, no punctuation."
                    'Answer in this format json: {{"name": "the chat name"}}',
                ),
                ("human", "{message}"),
            ]
        )
        result: _ChatName = await (prompt | llm).ainvoke({"message": message[:500]})  # type: ignore
        return result.name.strip()
    except Exception as e:
        logger.warning(f"Failed to generate chat name, using fallback: {str(e)}")
        return message[:50].strip()


class ChatService:
    def __init__(self, auth: AuthProvider):
        self._auth = auth
        self._accessible_org_ids: Optional[set[str]] = None

    @staticmethod
    def _parse_chat_object_id(chat_id: str) -> Optional[PydanticObjectId]:
        try:
            return PydanticObjectId(chat_id)
        except Exception:
            return None

    async def get_chat(self, chat_id: str) -> Optional[Chat]:
        object_id = self._parse_chat_object_id(chat_id)
        if object_id is None:
            return None
        chat = await Chat.find_one(Chat.id == object_id)
        return chat

    async def _get_accessible_org_ids(self) -> set[str]:
        if self._accessible_org_ids is not None:
            return self._accessible_org_ids

        user = self._auth.get_user()
        org_ids: set[str] = set()

        if user.org_id:
            org_ids.add(str(user.org_id))

        try:
            payload = await BackendClient(self._auth).get("organizations")
            organizations = payload.get("organizations", []) if isinstance(payload, dict) else []
            for org in organizations:
                org_id = org.get("id") if isinstance(org, dict) else None
                if org_id:
                    org_ids.add(str(org_id))
        except Exception as exc:
            # Keep chat features functional even if organization lookup fails.
            logger.warning(f"Failed to resolve organization memberships for chat scope: {exc}")

        self._accessible_org_ids = org_ids
        return org_ids

    async def get_chat_if_accessible(self, chat_id: str) -> Optional[Chat]:
        chat = await self.get_chat(chat_id)
        if chat is None:
            return None

        user = self._auth.get_user()
        if chat.org_id:
            return chat if chat.org_id in await self._get_accessible_org_ids() else None

        return chat if chat.u_id == str(user.id) else None

    async def require_chat_access(self, chat_id: str) -> Chat:
        chat = await self.get_chat_if_accessible(chat_id)
        if chat is None:
            raise HTTPException(status_code=404, detail="Chat not found")
        return chat

    async def _get_paginated_chats(self, query, limit: int, offset: int) -> Tuple[list[Chat], bool]:
        capped_limit = max(1, min(limit, 50))
        safe_offset = max(0, offset)
        rows = (
            await query.sort("-created_at")
            .skip(safe_offset)
            .limit(capped_limit + 1)
            .to_list()
        )
        has_more = len(rows) > capped_limit
        return rows[:capped_limit], has_more

    async def get_user_chats(self, limit: int = 15, offset: int = 0) -> Tuple[list[Chat], bool]:
        user = self._auth.get_user()
        query = Chat.find(
            Chat.u_id == str(user.id),
            Chat.org_id == None,
        )
        return await self._get_paginated_chats(query, limit, offset)

    async def get_org_chats(self, limit: int = 15, offset: int = 0) -> Tuple[list[Chat], bool]:
        user = self._auth.get_user()
        if not user.org_id:
            return [], False

        current_org_id = str(user.org_id)
        if current_org_id not in await self._get_accessible_org_ids():
            return [], False

        query = Chat.find(Chat.org_id == current_org_id)
        return await self._get_paginated_chats(query, limit, offset)

    async def get_specific_org_chats(
        self, org_id: str, limit: int = 15, offset: int = 0
    ) -> Tuple[list[Chat], bool]:
        if org_id not in await self._get_accessible_org_ids():
            return [], False

        query = Chat.find(Chat.org_id == org_id)
        return await self._get_paginated_chats(query, limit, offset)

    async def get_all_accessible_chats(
        self, limit: int = 15, offset: int = 0
    ) -> Tuple[list[Chat], bool]:
        user = self._auth.get_user()
        user_id = str(user.id)
        org_ids = list(await self._get_accessible_org_ids())

        personal_condition = And(Chat.u_id == user_id, Chat.org_id == None)
        if org_ids:
            query = Chat.find(Or(personal_condition, In(Chat.org_id, org_ids)))
        else:
            query = Chat.find(personal_condition)
        return await self._get_paginated_chats(query, limit, offset)

    async def get_chat_messages(self, chat_id: str, limit: int | None = None) -> list:
        """Return the message history for *chat_id* from the ``chat_messages``
        collection.

        Each message in the collection is stored as an independent document
        so the history is never overwritten by LangGraph summarisation.
        Messages are returned sorted by insertion order (``created_at``).

        Args:
            chat_id: The Chat document id.
            limit:   When provided, return only the *most-recent* ``limit``
                     messages.  Omit (or pass ``None``) for the full history.

        Falls back to the LangGraph checkpointer for legacy chats that have
        no ``ChatMessage`` documents yet.
        """
        # --- Primary source: ChatMessage collection --------------------------
        query = ChatMessage.find(ChatMessage.chat_id == chat_id).sort("created_at")
        if limit is not None:
            # Fetch the N most-recent messages: sort descending, take N, then
            # re-sort ascending so callers always receive oldest-first order.
            query = (
                ChatMessage.find(ChatMessage.chat_id == chat_id)
                .sort("-created_at")
                .limit(limit)
            )

        docs = await query.to_list()

        if docs:
            # Re-sort ascending when we fetched in descending order for limit.
            if limit is not None:
                docs = list(reversed(docs))
            try:
                return [message.data["data"] for message in docs]  # type: ignore
            except Exception as exc:
                logger.warning(
                    f"⚠️  Failed to deserialise ChatMessage docs for chat "
                    f"{chat_id}: {exc} — falling back to checkpointer."
                )

        # --- Legacy fallback: LangGraph checkpointer -------------------------
        chat = await self.get_chat(chat_id)
        if not chat:
            raise ValueError("Chat not found")

        checkpointer = get_mongo_checkpointer()
        checkpoint = await checkpointer.aget(
            config={"configurable": {"thread_id": chat.thread_id}}
        )
        if checkpoint and checkpoint["channel_values"].get("messages"):
            return checkpoint["channel_values"]["messages"]

        return []

    async def save_chat_messages(
        self, chat_id: str, messages: list[BaseMessage]
    ) -> None:
        """Append any *new* messages in *messages* to the ``chat_messages``
        collection.

        Only messages whose ``id`` is not already present for this chat are
        inserted.  Previously-saved messages are never modified, so
        LangGraph summarisation compressing the in-memory state has no effect
        on the persisted history.

        Args:
            chat_id:  The Chat document id.
            messages: The full list of ``BaseMessage`` objects returned by the
                      agent (may include already-persisted older messages).
        """
        if not messages:
            return

        # Fetch only the message_id field of documents already in the DB to
        # avoid loading full data payloads unnecessarily.
        existing_ids: set[str] = {
            doc.message_id
            for doc in await ChatMessage.find(ChatMessage.chat_id == chat_id)
            .project(_MessageIdProjection)
            .to_list()  # type: ignore[arg-type]
        }

        new_docs: list[ChatMessage] = []
        for msg in messages:
            if not msg.id or msg.id in existing_ids:
                continue  # skip already-persisted or id-less messages
            # Skip SystemMessages — these are rolling summaries injected by
            # SummarizationNode and must not be stored as chat history because
            # they are regenerated every turn and would pollute the persisted log.
            if isinstance(msg, SystemMessage):
                continue
            serialised = messages_to_dict([msg])[0]
            new_docs.append(
                ChatMessage(
                    chat_id=chat_id,
                    message_id=msg.id,
                    data=serialised,
                )
            )

        if not new_docs:
            logger.debug(
                f"💾 No new messages to persist for chat {chat_id} "
                f"({len(messages)} message(s) already stored)."
            )
            return

        await ChatMessage.insert_many(new_docs)
        logger.debug(
            f"💾 Inserted {len(new_docs)} new message(s) for chat {chat_id} "
            f"(skipped {len(messages) - len(new_docs)} already-stored)."
        )

    async def resolve_chat(
        self,
        message: str,
        agents: List[str],
        chat_id: Optional[str] = None,
        is_org: bool = False,
        organization_id: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> Chat:
        """Return an existing chat by ID, or create a new one with an AI-generated name.

        Args:
            message:    The user's first message (used for name generation).
            agents:     Agent identifiers for the chat.
            chat_id:    If provided, attempt to load this chat first.
            is_org:     Whether this is an organisation-scoped chat.
            request_id: Optional request ID used as a thread_id prefix.

        Returns:
            A persisted Chat document.
        """
        if chat_id:
            chat = await self.get_chat_if_accessible(chat_id)
            if chat:
                return chat

        user = self._auth.get_user()
        org_ids = await self._get_accessible_org_ids()
        thread_id = f"{request_id}_{uuid4()}" if request_id else str(uuid4())
        name = await _generate_chat_name(message)

        target_org_id: Optional[str] = None
        if is_org or organization_id:
            requested_org_id = organization_id or (str(user.org_id) if user.org_id else None)
            if not requested_org_id:
                raise HTTPException(status_code=400, detail="Organization context is required")
            if requested_org_id not in org_ids:
                raise HTTPException(status_code=403, detail="Organization access denied")
            target_org_id = requested_org_id

        chat = Chat(
            u_id=str(user.id),
            org_id=target_org_id,
            thread_id=thread_id,
            agents=agents,
            name=name,
        )
        await chat.insert()
        return chat
