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
