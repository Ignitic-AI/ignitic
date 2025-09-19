from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from models.user import User
from core.auth import get_auth, AuthProvider
from services.workflow_session_service import WorkflowSessionService
from services.workflow_session_cleanup_service import WorkflowSessionCleanupService
from models.automations.workflow_session import WorkflowSession, SessionStatus

router = APIRouter(prefix="/workflow-session")


class SessionStatusResponse(BaseModel):
    """Response model for session status."""

    session_id: str
    status: SessionStatus
    webhook_url: Optional[str]
    expires_at: str
    execution_count: int
    max_executions: Optional[int]
    created_at: str
    last_activity_at: str


class ToolSessionRequest(BaseModel):
    """Request model for intelligent session retrieval/creation."""

    template_id: str  # Can be ignitic_identifier or MongoDB ID
    duration_minutes: Optional[int] = 15
    max_executions: Optional[int] = 50
    extend_minutes: Optional[int] = 10  # How much to extend existing sessions


class ToolSessionResponse(BaseModel):
    """Response model for intelligent session handling."""

    session_id: str
    webhook_url: str
    status: SessionStatus
    expires_at: str
    max_executions: Optional[int]
    template_id: str
    ignitic_identifier: str
    action_taken: str  # "created", "extended", "returned_existing"
    execution_count: int


@router.post("/", response_model=ToolSessionResponse)
async def resolve_session(
    request: ToolSessionRequest,
    auth: AuthProvider = Depends(get_auth),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Intelligent session management endpoint.

    This endpoint handles session retrieval, creation, and extension intelligently:
    - If no active session exists for the template: creates a new session
    - If an active session exists and is free (not executing): extends and returns it
    - If an active session exists but is executing: returns it as-is

    Args:
        request: Session parameters (template_id can be ignitic_identifier or MongoDB ID)
        user: Authenticated user

    Returns:
        GetOrCreateSessionResponse: Session details with action taken
    """
    try:
        from beanie.operators import Or, And

        # Get user from auth provider
        user = await auth.get_user()

        # First, find the template to get both ID and ignitic_identifier
        template = await WorkflowSessionService._find_template(request.template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Workflow template not found")

        # Look for existing active sessions for this template and user/org
        existing_session = await WorkflowSession.find_one(
            And(
                WorkflowSession.template_id == str(template.id),
                Or(
                    WorkflowSession.u_id == user.id,
                    WorkflowSession.org_id == user.org_id,
                ),
                Or(
                    WorkflowSession.status == SessionStatus.ACTIVE,
                    WorkflowSession.status == SessionStatus.EXECUTING,
                ),
            )
        )

        if existing_session:
            # Check if session is expired
            if existing_session.is_expired():
                # Mark as expired and continue to create new session
                existing_session.status = SessionStatus.EXPIRED
                await existing_session.save()
            else:
                # Session exists and is valid
                action_taken = "returned_existing"

                # If session is ACTIVE (not executing), extend it
                if existing_session.status == SessionStatus.ACTIVE:
                    existing_session.extend_expiry(request.extend_minutes or 10)
                    await existing_session.save()
                    action_taken = "extended"

                return ToolSessionResponse(
                    session_id=existing_session.session_id,
                    webhook_url=str(existing_session.webhook_url)
                    if existing_session.webhook_url
                    else "",
                    status=existing_session.status,
                    expires_at=existing_session.expires_at.isoformat(),
                    max_executions=existing_session.max_executions,
                    template_id=existing_session.template_id,
                    ignitic_identifier=existing_session.ignitic_identifier,
                    action_taken=action_taken,
                    execution_count=existing_session.execution_count,
                )

        # No active session found, create a new one
        session = await WorkflowSessionService.create_session(
            template_id=request.template_id,
            user=user,
            duration_minutes=request.duration_minutes,
            max_executions=request.max_executions,
        )

        return ToolSessionResponse(
            session_id=session.session_id,
            webhook_url=str(session.webhook_url) if session.webhook_url else "",
            status=session.status,
            expires_at=session.expires_at.isoformat(),
            max_executions=session.max_executions,
            template_id=session.template_id,
            ignitic_identifier=session.ignitic_identifier,
            action_taken="created",
            execution_count=session.execution_count,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{template_id}", response_model=ToolSessionResponse)
async def resolve_session_by_template(
    template_id: str,
    duration_minutes: int = 15,
    max_executions: int = 50,
    extend_minutes: int = 10,
    auth: AuthProvider = Depends(get_auth),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Convenient GET endpoint for intelligent session management by template ID.

    This is a GET version of the /get-or-create endpoint for easier integration.
    Query parameters allow customization of session behavior.

    Args:
        template_id: Template ignitic_identifier or MongoDB ID
        duration_minutes: Session duration for new sessions (default: 15)
        max_executions: Max executions for new sessions (default: 50)
        extend_minutes: Minutes to extend existing sessions (default: 10)
        user: Authenticated user

    Returns:
        GetOrCreateSessionResponse: Session details with action taken
    """
    request = ToolSessionRequest(
        template_id=template_id,
        duration_minutes=duration_minutes,
        max_executions=max_executions,
        extend_minutes=extend_minutes,
    )

    return await resolve_session(request, auth, background_tasks)


@router.get("/{session_id}", response_model=SessionStatusResponse)
async def get_session_status(session_id: str, auth: AuthProvider = Depends(get_auth)):
    """
    Get the status of a tool session.

    Args:
        session_id: Session identifier
        auth: Authentication provider

    Returns:
        SessionStatusResponse: Current session status and details
    """
    user = await auth.get_user()
    session = await WorkflowSessionService.get_session(session_id, user)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return SessionStatusResponse(
        session_id=session.session_id,
        status=session.status,
        webhook_url=str(session.webhook_url) if session.webhook_url else None,
        expires_at=session.expires_at.isoformat(),
        execution_count=session.execution_count,
        max_executions=session.max_executions,
        created_at=session.created_at.isoformat(),
        last_activity_at=session.last_activity_at.isoformat(),
    )


@router.post("/{session_id}/extend")
async def extend_session(
    session_id: str, minutes: int = 15, auth: AuthProvider = Depends(get_auth)
):
    """
    Extend a tool session's expiry time.

    Args:
        session_id: Session identifier
        minutes: Minutes to extend (max respects global limits)
        auth: Authentication provider

    Returns:
        dict: Updated session expiry information
    """
    try:
        user = await auth.get_user()
        session = await WorkflowSessionService.extend_session(session_id, user, minutes)

        return {
            "session_id": session.session_id,
            "expires_at": session.expires_at.isoformat(),
            "message": f"Session extended by {minutes} minutes",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{session_id}")
async def cleanup_session(
    session_id: str, force: bool = False, auth: AuthProvider = Depends(get_auth)
):
    """
    Manually cleanup/delete a tool session.

    Args:
        session_id: Session identifier
        force: Force cleanup even if workflow is executing
        auth: Authentication provider

    Returns:
        dict: Cleanup result
    """
    try:
        # Verify user owns the session
        user = await auth.get_user()
        session = await WorkflowSessionService.get_session(session_id, user)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        success = await WorkflowSessionService.cleanup_session(session_id, force)

        if success:
            return {"message": "Session cleaned up successfully"}
        else:
            return {"message": "Cleanup scheduled (workflow is executing)"}

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
        from beanie.operators import Or, And

        # Get user from auth provider
        user = await auth.get_user()

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

        return [
            {
                "session_id": session.session_id,
                "status": session.status,
                "template_id": session.template_id,
                "ignitic_identifier": session.ignitic_identifier,
                "webhook_url": str(session.webhook_url)
                if session.webhook_url
                else None,
                "created_at": session.created_at.isoformat(),
                "expires_at": session.expires_at.isoformat(),
                "execution_count": session.execution_count,
                "max_executions": session.max_executions,
            }
            for session in sessions
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Webhook endpoint for tool execution tracking
@router.post("/webhook/{session_id}")
async def session_webhook_handler(session_id: str):
    """
    Handle webhook calls to track session activity.
    This endpoint is called by N8N before executing the actual workflow.

    Args:
        session_id: Session identifier from URL

    Returns:
        dict: Execution status
    """
    try:
        # Mark execution and check if session is still valid
        can_execute = await WorkflowSessionService.mark_execution(session_id)

        if not can_execute:
            raise HTTPException(
                status_code=410, detail="Session expired or execution limit reached"
            )

        return {"status": "ok", "session_id": session_id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Admin endpoints (optional)
@router.get("/admin/stats")
async def get_cleanup_stats(auth: AuthProvider = Depends(get_auth)):
    """Get cleanup statistics (admin only)."""
    # Add admin check here if needed
    return await WorkflowSessionCleanupService.get_cleanup_stats()


@router.post("/admin/cleanup")
async def manual_cleanup(
    force_old: bool = False, auth: AuthProvider = Depends(get_auth)
):
    """Manually trigger cleanup (admin only)."""
    # Add admin check here if needed

    cleaned = await WorkflowSessionCleanupService.cleanup_expired_sessions()
    retried = await WorkflowSessionCleanupService.retry_failed_cleanups()

    result = {"cleaned": cleaned, "retried": retried}

    if force_old:
        force_cleaned = await WorkflowSessionCleanupService.force_cleanup_old_sessions()
        result["force_cleaned"] = force_cleaned

    return result
