from typing import List, Optional
from uuid import uuid4

from beanie import PydanticObjectId
from langchain_core.messages import BaseMessage, messages_to_dict, messages_from_dict
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

from core.auth import AuthProvider
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

    async def get_chat(self, chat_id: str):
        chat = await Chat.find_one(Chat.id == PydanticObjectId(chat_id))
        return chat

    async def get_user_chats(self):
        user = self._auth.get_user()
        chats = await Chat.find(
            Chat.u_id == str(user.id),
            Chat.org_id == None,
        ).to_list()
        return chats

    async def get_org_chats(self):
        user = self._auth.get_user()
        chats = await Chat.find((Chat.org_id == str(user.org_id))).to_list()
        return chats

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
                return messages_from_dict([doc.data for doc in docs])
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
            try:
                chat = await self.get_chat(chat_id)
                if chat:
                    return chat
            except Exception:
                pass

        user = self._auth.get_user()
        thread_id = f"{request_id}_{uuid4()}" if request_id else str(uuid4())
        name = await _generate_chat_name(message)

        chat = Chat(
            u_id=str(user.id),
            org_id=str(user.org_id) if is_org and user.org_id else None,
            thread_id=thread_id,
            agents=agents,
            name=name,
        )
        await chat.insert()
        return chat
