from beanie import PydanticObjectId
from core.auth import AuthProvider
from models.chat import Chat
from services.agents.checkpointers import get_mongo_checkpointer


class ChatService:
    def __init__(self, auth: AuthProvider):
        self._auth = auth

    async def get_chat(self, chat_id: str):
        chat = await Chat.find_one(Chat.id == PydanticObjectId(chat_id))
        return chat

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
