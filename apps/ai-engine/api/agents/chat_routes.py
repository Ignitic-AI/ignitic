from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel, Field
from core.auth import get_auth, AuthProvider
from models.chat import PrebuiltAgents, Chat
from services.agents.agent_service import AgentService
from langchain_core.messages import BaseMessage
from services.agents.chat_service import ChatService

router = APIRouter(prefix="/chat")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, description="Message cannot be empty")
    chat_id: Optional[str] = None
    agents: List[str] = Field(
        default_factory=list, description="The agent handling the chat"
    )
    model: Optional[str] = Field(
        default=None,
        description="OpenRouter model id to use for the chat (e.g., 'deepseek/deepseek-chat-v3-0324:free')",
    )
    is_org: bool = Field(
        default=False,
        description="Whether the chat is for an organization or an individual user",
    )
    image_urls: Optional[List[str]] = Field(
        default=None,
        description="Optional list of publicly accessible image URLs to include with the message",
    )
    file_urls: Optional[List[str]] = Field(
        default=None,
        description="Optional list of publicly accessible file URLs (PDF, DOCX, etc.) to include with the message",
    )


class ChatResponse(BaseModel):
    chat_id: str
    thread_id: str
    messages: List[BaseMessage]


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest, auth: AuthProvider = Depends(get_auth)):
    """
    Chat with the super agent

    Args:
        request: Chat request containing message and optional thread_id
        user: Authenticated user

    Returns:
        ChatResponse: Agent response with thread_id and conversation_id
    """

    try:
        user = auth.get_user()
        agent_service = AgentService(auth=auth)

        chat = await ChatService(auth=auth).resolve_chat(
            message=request.message,
            agents=request.agents,
            chat_id=request.chat_id,
            is_org=request.is_org,
        )

        logger.debug(f"Chat resolved: {chat}")

        try:
            # Get agents based on org flag
            if not request.is_org:
                agents = await agent_service.get_user_agents(chat.agents)
            else:
                agents = await agent_service.get_org_agents(chat.agents)

            agent_response = await agent_service.ainvoke_agents(
                agents=agents,
                message=request.message,
                thread_id=chat.thread_id,
                chat_id=str(chat.id),
                model=request.model,
                image_urls=request.image_urls,
                file_urls=request.file_urls,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Agent failed: {str(e)}")

        return ChatResponse(
            chat_id=str(chat.id),
            thread_id=chat.thread_id,
            messages=agent_response["messages"] if agent_response is not None else [],
        )

    except HTTPException as he:
        raise he

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


class ChatListItem(BaseModel):
    id: str
    name: Optional[str]
    thread_id: str
    agents: List[str]


@router.get("/", response_model=List[ChatListItem])
async def list_chats(is_org: bool = False, auth: AuthProvider = Depends(get_auth)):
    user = auth.get_user()
    try:
        chat_service = ChatService(auth=auth)
        chats = await (
            chat_service.get_org_chats() if is_org else chat_service.get_user_chats()
        )
        items: List[ChatListItem] = []
        for c in chats:
            items.append(
                ChatListItem(
                    id=str(c.id),
                    name=c.name,
                    thread_id=c.thread_id,
                    agents=list(c.agents),
                )
            )
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list chats: {str(e)}")


class ChatDetail(BaseModel):
    id: str
    name: Optional[str]
    thread_id: str
    agents: List[str]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@router.get("/{chat_id}", response_model=ChatDetail)
async def get_chat(chat_id: str, auth: AuthProvider = Depends(get_auth)):
    user = auth.get_user()
    chat = await Chat.get(chat_id)
    if not chat or not (
        chat.u_id == str(user.id) or (chat.org_id and chat.org_id == str(user.org_id))
    ):
        raise HTTPException(status_code=404, detail="Chat not found")
    return ChatDetail(
        id=str(chat.id),
        name=chat.name,
        thread_id=chat.thread_id,
        agents=list(chat.agents) if list(chat.agents) != [] else list(PrebuiltAgents),
        created_at=chat.created_at.isoformat() if chat.created_at else None,
        updated_at=chat.updated_at.isoformat() if chat.updated_at else None,
    )


class MessagesResponse(BaseModel):
    chat_id: str
    thread_id: str
    messages: List[Any]


@router.get("/{chat_id}/messages", response_model=MessagesResponse)
async def get_chat_messages(
    chat_id: str,
    limit: Optional[int] = None,
    auth: AuthProvider = Depends(get_auth),
):
    user = auth.get_user()

    try:
        chat = await Chat.get(chat_id)
        if not chat or not (
            chat.u_id == str(user.id)
            or (chat.org_id and chat.org_id == str(user.org_id))
        ):
            raise HTTPException(status_code=404, detail="Chat not found")

        messages = await ChatService(auth=auth).get_chat_messages(chat_id, limit=limit)

        if messages is None:
            messages = []

        return MessagesResponse(
            chat_id=str(chat.id), thread_id=chat.thread_id, messages=messages
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get chat messages: {str(e)}"
        )
