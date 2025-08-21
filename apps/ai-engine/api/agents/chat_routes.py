from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from core.auth import get_current_user
from models.user import User
from models.chat import Chat
from services.agents.agents import ainvoke_agents
from uuid import uuid4
from langchain_core.messages import BaseMessage
from services.agents.agents import AgentResolver
from services.agents.tool_loader import get_tools_for_agent
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/agents")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, description="Message cannot be empty")
    chat_id: Optional[str] = None
    agents: List[Literal["product_researcher_agent", "marketer_agent"]] = Field(
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
async def chat(request: ChatRequest, user: User = Depends(get_current_user)):
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


class AgentInfo(BaseModel):
    name: str
    tools: List[ToolInfo]


def _tools_for_agent(agent_name: str) -> List[ToolInfo]:
    tool_objs = get_tools_for_agent(agent_name)
    tools: List[ToolInfo] = []
    for t in tool_objs:
        desc = getattr(t, "description", None) or (t.__doc__ if hasattr(t, "__doc__") else None)
        tools.append(
            ToolInfo(
                name=getattr(t, "name", t.__class__.__name__),
                description=(desc.strip() if isinstance(desc, str) else None),
            )
        )
    return tools


@router.get("/agents", response_model=List[AgentInfo])
async def list_agents(user: User = Depends(get_current_user)):
    agents = []
    for name in AgentResolver.AGENTS:
        agents.append(AgentInfo(name=name, tools=_tools_for_agent(name)))
    return agents


@router.get("/agents/{agent_name}/tools", response_model=List[ToolInfo])
async def list_agent_tools(agent_name: Literal["product_researcher_agent", "marketer_agent"], user: User = Depends(get_current_user)):
    return _tools_for_agent(agent_name)


class ChatListItem(BaseModel):
    id: str
    name: Optional[str]
    thread_id: str
    agents: List[str]


@router.get("/chats", response_model=List[ChatListItem])
async def list_chats(user: User = Depends(get_current_user)):
    chats = await Chat.find(
        (Chat.u_id == str(user.id)) | ((Chat.org_id == str(user.org_id)) if user.org_id else False)
    ).to_list()
    items: List[ChatListItem] = []
    for c in chats:
        items.append(
            ChatListItem(
                id=str(c.id),
                name=c.name,
                thread_id=c.thread_id,
                agents=c.agents,
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
async def get_chat(chat_id: str, user: User = Depends(get_current_user)):
    chat = await Chat.get(chat_id)
    if not chat or not (
        chat.u_id == str(user.id) or (chat.org_id and chat.org_id == str(user.org_id))
    ):
        raise HTTPException(status_code=404, detail="Chat not found")
    return ChatDetail(
        id=str(chat.id),
        name=chat.name,
        thread_id=chat.thread_id,
        agents=chat.agents,
        created_at=chat.created_at.isoformat() if chat.created_at else None,
        updated_at=chat.updated_at.isoformat() if chat.updated_at else None,
    )


class MessagesResponse(BaseModel):
    chat_id: str
    thread_id: str
    messages: List[BaseMessage]


@router.get("/chats/{chat_id}/messages", response_model=MessagesResponse)
async def get_chat_messages(chat_id: str, user: User = Depends(get_current_user)):
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

    return MessagesResponse(chat_id=str(chat.id), thread_id=chat.thread_id, messages=messages)


# @router.get("/{id}")
# async def get_credential(id: str, user: User = Depends(get_current_user)):
#     """
#     Retrieve a specific SMTP credential by its ID.

#     Args:
#         id (str): The ID of the SMTP credential to retrieve.
#         user (User): The current authenticated user.

#     Returns:
#         N8NSMTPCredential: The requested SMTP credential in JSON format.

#     Raises:
#         HTTPException: If the credential is not found, returns a 404 status code.
#     """
#     try:
#         credential = await N8NSMTPCredential.find_one(
#             N8NSMTPCredential.id == id
#             and (
#                 N8NSMTPCredential.u_id == user.id
#                 or N8NSMTPCredential.org_id == user.org_id
#             )
#         )
#         if not credential:
#             raise HTTPException(status_code=404, detail="Credential not found")
#         return {
#             **credential.model_dump(),
#             "id": str(credential.id),
#         }
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=str(e))
