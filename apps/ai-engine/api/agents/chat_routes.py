from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from core.auth import get_user_auth
from models.user import User
from models.chat import Agent, Chat
from services.agents.agents import ainvoke_agents
from uuid import uuid4
from langchain_core.messages import BaseMessage
from services.agents.mcp_client import get_tools_for_agent
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/agents")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, description="Message cannot be empty")
    chat_id: Optional[str] = None
    agents: List[Agent] = Field(
        default_factory=list, description="The agent handling the chat"
    )
    model: Optional[str] = Field(
        default=None,
        description="OpenRouter model id to use for the chat (e.g., 'deepseek/deepseek-chat-v3-0324:free')",
    )


class ChatResponse(BaseModel):
    chat_id: str
    thread_id: str
    messages: List[BaseMessage]


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, user: User = Depends(get_user_auth)):
    """
    Chat with the super agent

    Args:
        request: Chat request containing message and optional thread_id
        user: Authenticated user

    Returns:
        ChatResponse: Agent response with thread_id and conversation_id
    """

    print(f"Chat request: {request}")
    print(f"User: {user}")
    try:
        chat = None
        if request.chat_id:
            chat = await Chat.get(request.chat_id)
            if not chat:
                raise HTTPException(status_code=404, detail="Chat not found")
        else:
            # Create chat name safely
            chat_name = (
                f"Chat with {', '.join(request.agents)}"
                if request.agents
                else "New Chat"
            )

            print(f"Creating chat with agents: {request.agents}")
            print(f"Chat name: {chat_name}")

            chat = Chat(
                u_id=str(user.id),
                org_id=str(user.org_id) if user.org_id else None,
                thread_id=str(uuid4()),
                agents=request.agents,
                name=chat_name,
            )

        print(f"Chat initialized: {chat}")

        try:
            agent_response = await ainvoke_agents(
                agents=chat.agents,
                message=request.message,
                thread_id=chat.thread_id,
                model=request.model,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Agent failed: {str(e)}")

        # Save chat if it's new
        if not request.chat_id:
            await chat.insert()

        return ChatResponse(
            chat_id=str(chat.id),
            thread_id=chat.thread_id,
            messages=agent_response["messages"] if agent_response is not None else [],
        )

    except Exception as e:
        print(f"Chat error: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


class ToolInfo(BaseModel):
    name: str
    description: Optional[str] = None

    @staticmethod
    def from_base_tool(tool) -> "ToolInfo":
        return ToolInfo(name=tool.name, description=tool.description)


class AgentInfo(BaseModel):
    name: str
    tools: List[ToolInfo]


@router.get("/", response_model=List[AgentInfo])
async def list_agents(user: User = Depends(get_user_auth)):
    agents = []
    for agent in list(Agent):
        agents.append(
            AgentInfo(
                name=agent.value,
                tools=[
                    ToolInfo.from_base_tool(base_tool)
                    for base_tool in (await get_tools_for_agent(agent))
                ],
            )
        )
    return agents


@router.get("/{agent_name}/tools", response_model=List[ToolInfo])
async def list_agent_tools(
    agent: Agent,
    user: User = Depends(get_user_auth),
):
    return [
        ToolInfo.from_base_tool(base_tool)
        for base_tool in (await get_tools_for_agent(agent))
    ]


class ChatListItem(BaseModel):
    id: str
    name: Optional[str]
    thread_id: str
    agents: List[Agent]


@router.get("/chats", response_model=List[ChatListItem])
async def list_chats(user: User = Depends(get_user_auth)):
    chats = await Chat.find(
        (Chat.u_id == str(user.id))
        or ((Chat.org_id == str(user.org_id)) if user.org_id else False)
    ).to_list()
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


class ChatDetail(BaseModel):
    id: str
    name: Optional[str]
    thread_id: str
    agents: List[str]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@router.get("/chats/{chat_id}", response_model=ChatDetail)
async def get_chat(chat_id: str, user: User = Depends(get_user_auth)):
    chat = await Chat.get(chat_id)
    if not chat or not (
        chat.u_id == str(user.id) or (chat.org_id and chat.org_id == str(user.org_id))
    ):
        raise HTTPException(status_code=404, detail="Chat not found")
    return ChatDetail(
        id=str(chat.id),
        name=chat.name,
        thread_id=chat.thread_id,
        agents=list(chat.agents),
        created_at=chat.created_at.isoformat() if chat.created_at else None,
        updated_at=chat.updated_at.isoformat() if chat.updated_at else None,
    )


class MessagesResponse(BaseModel):
    chat_id: str
    thread_id: str
    messages: List[BaseMessage]


@router.get("/chats/{chat_id}/messages", response_model=MessagesResponse)
async def get_chat_messages(chat_id: str, user: User = Depends(get_user_auth)):
    chat = await Chat.get(chat_id)
    if not chat or not (
        chat.u_id == str(user.id) or (chat.org_id and chat.org_id == str(user.org_id))
    ):
        raise HTTPException(status_code=404, detail="Chat not found")

    mongo_uri = os.getenv("MONGO_URI")
    mongo_db = os.getenv("MONGO_DB_NAME")
    if not mongo_uri or not mongo_db:
        raise HTTPException(status_code=500, detail="MongoDB not configured")

    client = AsyncIOMotorClient(mongo_uri)
    db = client[mongo_db]
    coll = db["chat_checkpoints"]

    # Try to find latest checkpoint document for this thread_id
    doc = await coll.find_one(
        {
            "$or": [
                {"thread_id": chat.thread_id},
                {"config.configurable.thread_id": chat.thread_id},
            ]
        },
        sort=[("_id", -1)],
    )

    messages: List[BaseMessage] = []
    if doc:
        # Common locations for messages in LangGraph checkpoints
        values = doc.get("values") or {}
        msgs = values.get("messages") or doc.get("messages") or []
        messages = msgs

    return MessagesResponse(
        chat_id=str(chat.id), thread_id=chat.thread_id, messages=messages
    )
