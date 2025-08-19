from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from core.auth import get_current_user
from models.user import User
from models.chat import Chat
from services.agents.agents import ainvoke_agents
from uuid import uuid4
from langchain_core.messages import BaseMessage

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
