from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from models.user import User
from core.auth import get_auth, AuthProvider
from services.workflow_session_service import WorkflowSessionService
from models.automations.workflow_session import WorkflowSession, SessionStatus
from beanie.operators import Or, And
from beanie import PydanticObjectId
import httpx

router = APIRouter(prefix="/workflow-session")


class ToolSessionRequest(BaseModel):
    template_id: Optional[str] = None
    ignitic_identifier: Optional[str] = None


@router.post("/")
async def resolve_session(
    request: ToolSessionRequest,
    auth: AuthProvider = Depends(get_auth),
) :
    """
    Intelligent session management endpoint.
    This endpoint checks for existing active sessions for the given template and user/org.
    If an active session exists and is not expired, it returns that session.
    If the session is expired, it marks it as expired and creates a new session.
    If no active session exists, it creates a new session.
    Args:
        request: ToolSessionRequest containing template_id or ignitic_identifier
        auth: Authentication provider
    Returns:
        WorkflowSession: Session details with action taken
    Raises:

    """
    try:
        # Get user from auth provider
        user = auth.get_user()

        if not request.template_id and not request.ignitic_identifier:
            raise HTTPException(
                status_code=400,
                detail="Either template_id or ignitic_identifier must be provided",
            )

        session = await WorkflowSessionService(auth).resolve(
            template_id=request.template_id,
            ignitic_identifier=request.ignitic_identifier,
        )
        if not session:
            raise HTTPException(
                status_code=500, detail="Failed to create or resolve session"
            )
        return session.to_json()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def list_user_sessions(
    status: Optional[SessionStatus] = None,
    limit: int = 20,
    auth: AuthProvider = Depends(get_auth),
):
    """
    List user's tool sessions.

    Args:
        status: Filter by session status
        limit: Maximum number of sessions to return
        auth: Authentication provider

    Returns:
        list: List of user's sessions
    """
    try:
        # Get user from auth provider
        user = auth.get_user()

        # Build query
        base_condition = Or(
            WorkflowSession.u_id == user.id, WorkflowSession.org_id == user.org_id
        )

        if status:
            query_condition = And(base_condition, WorkflowSession.status == status)
        else:
            query_condition = base_condition

        sessions = (
            await WorkflowSession.find(query_condition)
            .limit(limit)
            .sort("-created_at")
            .to_list()
        )

        return [session.model_dump() for session in sessions]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{session_id}")
async def cleanup_session(session_id: str, auth: AuthProvider = Depends(get_auth)):
    """
    Cleanup (delete) a session by its ID.

    Args:
        session_id: The ID of the session to clean up.
        auth: Authentication provider.

    Returns:
        dict: Cleanup status message.
    """
    try:
        await WorkflowSessionService(auth).cleanup_session(session_id)
        return {"detail": "Session cleaned up successfully"}
       
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute/{session_id}")
async def session_execution_handler(session_id: str, body: dict):
    """
    Handle webhook calls to track session activity.
    This endpoint is called by N8N before executing the actual workflow.

    Args:
        session_id: Session identifier from URL

    Returns:
        dict: Execution status
    """
    try:
        print("Received execution request for session:", session_id)
        session = await WorkflowSession.find_one(
            WorkflowSession.id == PydanticObjectId(session_id)
        )

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        if not getattr(session, "workflow_url", None):
            raise HTTPException(
                status_code=400, detail="Session does not have a workflow_url"
            )

        try:
            session.active_executions_count += 1
            session.status = SessionStatus.EXECUTING
            session.last_activity_at = datetime.now()
            await session.save()

            workflow_url = str(session.workflow_url)
            async with httpx.AsyncClient() as client:
                response = await client.post(workflow_url, json=body)

            if response.status_code >= 200 and response.status_code < 300:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code, detail=response.text
                )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502, detail=f"Failed to reach workflow URL: {str(e)}"
            )
        finally:
            if session:
                session.active_executions_count = max(
                    0, session.active_executions_count - 1
                )
                if session.active_executions_count == 0:
                    session.status = SessionStatus.ACTIVE
                await session.save()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
