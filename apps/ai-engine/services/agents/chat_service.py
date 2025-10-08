

from beanie import PydanticObjectId
from core.auth import AuthProvider
from models.chat import Chat


class ChatService:
    def __init__(self, auth: AuthProvider):
        self._auth = auth

    async def get_chat(self, chat_id: str):
        chat = await Chat.find_one(Chat.id == PydanticObjectId(chat_id))
        return chat