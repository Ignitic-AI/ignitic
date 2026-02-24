from typing import List, Optional
from uuid import uuid4

from beanie import PydanticObjectId
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

from core.auth import AuthProvider
from models.chat import Chat
from services.agents.checkpointers import get_mongo_checkpointer
from services.agents.llms import get_llm

from loguru import logger


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
                    "Answer in this format json: {{\"name\": \"the chat name\"}}",
                ),
                ("human", "{message}"),
            ]
        )
        result: _ChatName = await (prompt | llm).ainvoke({"message": message[:500]}) # type: ignore
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
            (Chat.u_id == str(user.id) and Chat.org_id == None)
        ).to_list()
        return chats

    async def get_org_chats(self):
        user = self._auth.get_user()
        chats = await Chat.find((Chat.org_id == str(user.org_id))).to_list()
        return chats

    async def get_chat_messages(self, chat_id: str):
        chat = await self.get_chat(chat_id)
        if not chat:
            raise ValueError("Chat not found")

        checkpointer = get_mongo_checkpointer()
        checkpoint = await checkpointer.aget(
            config={"configurable": {"thread_id": chat.thread_id}}
        )

        if checkpoint and checkpoint["channel_values"]["messages"]:
            return checkpoint["channel_values"]["messages"]

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
