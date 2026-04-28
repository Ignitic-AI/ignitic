from typing import Any, List, Optional, Literal
import secrets
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Query,
)
from loguru import logger
from pydantic import BaseModel, Field
from core.auth import get_auth, AuthProvider
from models.chat import Chat, ChatMessage, ChatShare
from models.agent import PrebuiltAgents
from services.agents.agent_service import AgentService
from langchain_core.messages import BaseMessage
from services.agents.chat_service import ChatService
import json

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
    organization_id: Optional[str] = Field(
        default=None,
        description="Organization ID to scope the chat when is_org is true",
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
        agent_service = AgentService(auth=auth)
        scope_is_org = request.is_org or bool(request.organization_id)

        chat = await ChatService(auth=auth).resolve_chat(
            message=request.message,
            agents=request.agents,
            chat_id=request.chat_id,
            is_org=scope_is_org,
            organization_id=request.organization_id,
        )

        logger.debug(f"Chat resolved: {chat}")

        try:
            # Get agents based on org flag
            if not scope_is_org:
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
    org_id: Optional[str] = None


class ChatListPage(BaseModel):
    chats: List[ChatListItem]
    has_more: bool


@router.get("/", response_model=ChatListPage)
async def list_chats(
    scope: Optional[Literal["personal", "org", "all"]] = Query(default=None),
    is_org: bool = False,
    organization_id: Optional[str] = Query(default=None),
    limit: int = Query(default=15, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    auth: AuthProvider = Depends(get_auth),
):
    try:
        chat_service = ChatService(auth=auth)
        effective_scope = scope
        if effective_scope is None:
            effective_scope = "org" if is_org else "personal"

        if effective_scope == "all":
            chats, has_more = await chat_service.get_all_accessible_chats(
                limit=limit, offset=offset
            )
        elif effective_scope == "org":
            if organization_id:
                chats, has_more = await chat_service.get_specific_org_chats(
                    org_id=organization_id, limit=limit, offset=offset
                )
            else:
                chats, has_more = await chat_service.get_org_chats(
                    limit=limit, offset=offset
                )
        else:
            chats, has_more = await chat_service.get_user_chats(
                limit=limit, offset=offset
            )
        items: List[ChatListItem] = []
        for c in chats:
            items.append(
                ChatListItem(
                    id=str(c.id),
                    name=c.name,
                    thread_id=c.thread_id,
                    agents=list(c.agents),
                    org_id=c.org_id,
                )
            )
        return ChatListPage(chats=items, has_more=has_more)
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
    chat = await ChatService(auth=auth).require_chat_access(chat_id)
    return ChatDetail(
        id=str(chat.id),
        name=chat.name,
        thread_id=chat.thread_id,
        agents=list(chat.agents) if list(chat.agents) != [] else list(PrebuiltAgents),
        created_at=chat.created_at.isoformat() if chat.created_at else None,
        updated_at=chat.updated_at.isoformat() if chat.updated_at else None,
    )


class DeleteChatResponse(BaseModel):
    success: bool
    chat_id: str
    message: str


@router.delete("/{chat_id}", response_model=DeleteChatResponse)
async def delete_chat(chat_id: str, auth: AuthProvider = Depends(get_auth)):
    try:
        chat = await ChatService(auth=auth).require_chat_access(chat_id)

        # Remove persisted message history first, then delete the chat itself.
        await ChatMessage.find(ChatMessage.chat_id == chat_id).delete()
        await chat.delete()

        return DeleteChatResponse(
            success=True,
            chat_id=chat_id,
            message="Chat deleted successfully",
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete chat: {str(e)}")


class MessagesResponse(BaseModel):
    chat_id: str
    thread_id: str
    messages: List[Any]


class ShareChatResponse(BaseModel):
    token: str
    share_url_path: str


class SharedChatResponse(BaseModel):
    chat_id: str
    messages: List[Any]


def _sanitize_shared_messages(messages: List[Any]) -> List[dict]:
    """Expose display-safe human/ai/tool messages for public sharing."""
    safe_messages: List[dict] = []
    for raw in messages:
        msg = raw.get("data") if isinstance(raw, dict) and "data" in raw else raw
        if not isinstance(msg, dict):
            continue
        msg_type = msg.get("type")
        if msg_type not in {"human", "ai", "tool"}:
            continue
        content = msg.get("content")
        has_content = (
            isinstance(content, str) and content.strip() != ""
        ) or content is not None
        if not has_content:
            continue

        item: dict = {
            "type": msg_type,
            "content": content,
            "name": msg.get("name"),
        }
        if msg_type in {"human", "ai"}:
            item["image_urls"] = msg.get("image_urls", [])
            item["file_urls"] = msg.get("file_urls", [])
        if msg_type == "ai":
            item["tool_calls"] = msg.get("tool_calls", [])
        if msg_type == "tool":
            item["tool_call_id"] = msg.get("tool_call_id")
            item["status"] = msg.get("status")

        safe_messages.append(item)
    return safe_messages


@router.get("/{chat_id}/messages", response_model=MessagesResponse)
async def get_chat_messages(
    chat_id: str,
    limit: Optional[int] = None,
    auth: AuthProvider = Depends(get_auth),
):
    try:
        chat = await ChatService(auth=auth).require_chat_access(chat_id)

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


@router.post("/{chat_id}/share", response_model=ShareChatResponse)
async def create_chat_share(chat_id: str, auth: AuthProvider = Depends(get_auth)):
    """Create (or return existing) public read-only share token for a chat."""
    chat = await ChatService(auth=auth).require_chat_access(chat_id)
    existing_share = await ChatShare.find_one(
        {"chat_id": str(chat.id), "is_revoked": {"$ne": True}}
    )
    if existing_share:
        return ShareChatResponse(
            token=existing_share.token,
            share_url_path=f"/shared/chat/{existing_share.token}",
        )

    token = secrets.token_urlsafe(24)
    user = auth.get_user()
    share = ChatShare(
        token=token,
        chat_id=str(chat.id),
        created_by_u_id=str(user.id),
        org_id=chat.org_id,
    )
    await share.insert()
    return ShareChatResponse(token=token, share_url_path=f"/shared/chat/{token}")


@router.get("/shared/{token}", response_model=SharedChatResponse)
async def get_shared_chat_messages(token: str):
    """Public endpoint to resolve shared chat and return read-only message history."""
    share = await ChatShare.find_one({"token": token, "is_revoked": {"$ne": True}})
    if share is None:
        raise HTTPException(status_code=404, detail="Shared chat not found")

    chat_object_id = ChatService._parse_chat_object_id(share.chat_id)
    if chat_object_id is None:
        raise HTTPException(status_code=404, detail="Shared chat not found")

    chat = await Chat.find_one(Chat.id == chat_object_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Shared chat not found")

    # get_chat_messages only depends on chat id and does not require user context.
    messages = await ChatService(auth=None).get_chat_messages(share.chat_id)  # type: ignore[arg-type]
    if messages is None:
        messages = []

    return SharedChatResponse(
        chat_id=share.chat_id, messages=_sanitize_shared_messages(messages)
    )


# ---------------------------------------------------------------------------
# WebSocket streaming endpoint – used by the AI Engine CLI
# ---------------------------------------------------------------------------


class WSChatRequest(BaseModel):
    """Message schema sent by the CLI over the WebSocket connection."""

    message: str
    chat_id: Optional[str] = None
    agents: List[str] = Field(default_factory=list)
    model: Optional[str] = None
    is_org: bool = False
    organization_id: Optional[str] = None
    image_urls: Optional[List[str]] = None
    file_urls: Optional[List[str]] = None


@router.websocket("/ws")
async def chat_websocket(
    websocket: WebSocket,
    token: str = Query(
        default=None,
        description="Bearer JWT token (used when Authorization header is not available, e.g. browser clients)",
    ),
):
    """
    WebSocket endpoint for real-time streaming chat with agents.

    Preferred:  send ``Authorization: Bearer <JWT>`` as a header during the
                WebSocket upgrade (works with Python/CLI clients).
    Fallback:   pass ``?token=<JWT>`` as a query parameter (works with browser
                clients that cannot set custom headers).

    Client sends JSON matching WSChatRequest.
    Server streams back JSON AgentStreamResponseChunk objects followed by a
    final sentinel ``{"event": "done"}``.
    """
    await websocket.accept()
    logger.info("🔌 WebSocket CLI client connected")

    try:
        # Resolve token: prefer Authorization header, fall back to query param.
        try:
            auth_header = websocket.headers.get("authorization", "")
            if auth_header.lower().startswith("bearer "):
                resolved_token = auth_header[7:].strip()
            elif token:
                resolved_token = token.strip()
            else:
                await websocket.send_json(
                    {
                        "event": "error",
                        "detail": "Authentication required: provide Authorization header or ?token= query param",
                    }
                )
                await websocket.close(code=1008)
                return

            auth = AuthProvider.from_token(resolved_token)
            # Eagerly resolve the user so we fail-fast on invalid tokens
            auth.get_user()
        except HTTPException as auth_err:
            await websocket.send_json(
                {
                    "event": "error",
                    "detail": f"Authentication failed: {auth_err.detail}",
                }
            )
            await websocket.close(code=1008)
            return
        except Exception as auth_err:
            await websocket.send_json(
                {"event": "error", "detail": f"Authentication failed: {auth_err}"}
            )
            await websocket.close(code=1008)
            return

        await websocket.send_json({"event": "authenticated"})

        agent_service = AgentService(auth=auth)
        chat_service = ChatService(auth=auth)

        # Keep connection alive – handle multiple messages per session
        while True:
            try:
                raw = await websocket.receive_text()
            except WebSocketDisconnect:
                logger.info("🔌 WebSocket CLI client disconnected")
                break

            try:
                payload = WSChatRequest(**json.loads(raw))
            except Exception as parse_err:
                await websocket.send_json(
                    {
                        "event": "error",
                        "detail": f"Invalid request payload: {parse_err}",
                    }
                )
                continue

            try:
                scope_is_org = payload.is_org or bool(payload.organization_id)
                chat = await chat_service.resolve_chat(
                    message=payload.message,
                    agents=payload.agents,
                    chat_id=payload.chat_id,
                    is_org=scope_is_org,
                    organization_id=payload.organization_id,
                )

                if not scope_is_org:
                    agents = await agent_service.get_user_agents(chat.agents)
                else:
                    agents = await agent_service.get_org_agents(chat.agents)

                # Send chat metadata so the client knows the chat_id / thread_id
                await websocket.send_json(
                    {
                        "event": "chat_resolved",
                        "chat_id": str(chat.id),
                        "thread_id": chat.thread_id,
                    }
                )

                async for chunk in agent_service.astream_agents(
                    agents=agents,
                    message=payload.message,
                    thread_id=chat.thread_id,
                    chat_id=str(chat.id),
                    model=payload.model,
                    image_urls=payload.image_urls,
                    file_urls=payload.file_urls,
                ):
                    # chunk_idx = chunk.get("chunk_index", -1)
                    # content_len = len(chunk.get("content", ""))
                    # logger.debug(
                    #     f"📡 WS sending chunk #{chunk_idx}: {content_len} chars, agent={chunk.get('agent_name')}"
                    # )
                    await websocket.send_json({"event": "chunk", **chunk})

                logger.info(
                    f"✅ Streaming complete for chat {str(chat.id)}, thread {chat.thread_id}"
                )
                await websocket.send_json({"event": "done"})

            except HTTPException as he:
                await websocket.send_json({"event": "error", "detail": he.detail})
            except Exception as e:
                logger.exception(f"WebSocket chat error: {e}")
                await websocket.send_json(
                    {"event": "error", "detail": f"Agent error: {str(e)}"}
                )

    except WebSocketDisconnect:
        logger.info("🔌 WebSocket CLI client disconnected (outer)")
    except Exception as e:
        logger.exception(f"WebSocket handler error: {e}")
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
