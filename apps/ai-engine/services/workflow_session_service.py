import uuid
import asyncio
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException
from models.automations.workflow_session import WorkflowSession, SessionStatus
from models.automations.workflow_template import WorkflowTemplate
from models.automations.n8n.n8n_workflow_template import N8NWorkflowTemplate
from models.user import User
from services.n8n.n8n_workflow_service import (
    deploy_workflow_on_n8n,
    activate_workflow,
    delete_deployed_workflow_from_n8n,
    N8N_SERVER_URL,
)
from pydantic import HttpUrl, parse_obj_as
from utils.url import get_base_url
import requests
from services.n8n.consts import N8N_REQUEST_HEADERS


class WorkflowSessionService:
    """Service for managing ephemeral workflow sessions."""

    DEFAULT_SESSION_DURATION_MINUTES = 15
    MAX_SESSION_DURATION_MINUTES = 120  # 2 hours
    GRACE_PERIOD_MINUTES = 5
    MAX_EXECUTIONS_PER_SESSION = 50

    @classmethod
    async def create_session(
        cls,
        template_id: str,
        user: User,
        duration_minutes: Optional[int] = None,
        max_executions: Optional[int] = None,
    ) -> WorkflowSession:
        """
        Create a new workflow session by deploying a workflow template.

        Args:
            template_id: Workflow template ID or ignitic_identifier
            user: Authenticated user
            duration_minutes: Custom session duration (max 120 minutes)
            max_executions: Maximum executions allowed (max 50)

        Returns:
            WorkflowSession: Created session with webhook URL
        """
        try:
            # Validate duration
            duration = duration_minutes or cls.DEFAULT_SESSION_DURATION_MINUTES
            if duration > cls.MAX_SESSION_DURATION_MINUTES:
                duration = cls.MAX_SESSION_DURATION_MINUTES

            # Validate max executions
            max_exec = max_executions or cls.MAX_EXECUTIONS_PER_SESSION
            if max_exec > cls.MAX_EXECUTIONS_PER_SESSION:
                max_exec = cls.MAX_EXECUTIONS_PER_SESSION

            # Find template
            template = await cls._find_template(template_id)
            if not template:
                raise HTTPException(
                    status_code=404, detail="Workflow template not found"
                )

            # Generate session ID
            session_id = str(uuid.uuid4())

            # Create session record
            session = WorkflowSession(
                session_id=session_id,
                template_id=str(template.id),
                ignitic_identifier=template.ignitic_identifier,
                status=SessionStatus.CREATING,
                expires_at=datetime.now() + timedelta(minutes=duration),
                max_executions=max_exec,
                u_id=user.id,
                org_id=user.org_id,
            )

            # Save initial session
            await session.insert()

            # Deploy workflow (async to avoid blocking)
            await cls._deploy_session_workflow(session, template, user)

            return session

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to create session: {str(e)}"
            )

    @classmethod
    async def _find_template(cls, template_id: str) -> Optional[WorkflowTemplate]:
        """Find template by ID or ignitic_identifier."""
        from bson import ObjectId
        from beanie.operators import Or

        o_id = ObjectId(template_id) if ObjectId.is_valid(template_id) else None
        return await WorkflowTemplate.find_one(
            Or(
                WorkflowTemplate.id == o_id if o_id else False,
                WorkflowTemplate.ignitic_identifier == template_id,
            )
        )

    @classmethod
    async def _deploy_session_workflow(
        cls, session: WorkflowSession, template: WorkflowTemplate, user: User
    ):
        """Deploy workflow for the session."""
        try:

            if N8N_SERVER_URL is None:
                session.status = SessionStatus.FAILED
                await session.save()
                raise ValueError("N8N server URL is not configured")
            
            if template.workflow_type == "n8n":
                if not isinstance(template, N8NWorkflowTemplate):
                    raise ValueError("Template is not an N8N workflow template")

                # Generate unique webhook ID
                webhook_id = str(uuid.uuid4())
                template.n8n_json.nodes[0].webhookId = webhook_id
                template.n8n_json.nodes[0].parameters["path"] = (
                    f"workflow-session/{session.session_id}"
                )

                # Deploy to N8N
                n8n_id = await deploy_workflow_on_n8n(template, user)

                # Activate workflow
                activated = await activate_workflow(n8n_id)
                if not activated:
                    # Cleanup failed deployment
                    await delete_deployed_workflow_from_n8n(n8n_id)
                    session.status = SessionStatus.FAILED
                    await session.save()
                    raise ValueError("Failed to activate deployed workflow")

                # Update session with deployment details
                session.n8n_workflow_id = n8n_id
                session.webhook_url = parse_obj_as(
                    HttpUrl,
                    f"{get_base_url(N8N_SERVER_URL)}/webhook/workflow-session/{session.session_id}",
                )
                session.status = SessionStatus.ACTIVE
                await session.save()

            else:
                raise ValueError(f"Unsupported workflow type: {template.workflow_type}")

        except Exception as e:
            session.status = SessionStatus.FAILED
            await session.save()
            raise e

    @classmethod
    async def get_session(cls, session_id: str, user: User) -> Optional[WorkflowSession]:
        """Get session by ID with user access check."""
        from beanie.operators import Or, And

        session = await WorkflowSession.find_one(
            And(
                WorkflowSession.session_id == session_id,
                Or(WorkflowSession.u_id == user.id, WorkflowSession.org_id == user.org_id),
            )
        )

        if session and session.is_expired() and session.status == SessionStatus.ACTIVE:
            session.status = SessionStatus.EXPIRED
            await session.save()

        return session

    @classmethod
    async def extend_session(
        cls, session_id: str, user: User, minutes: int = 15
    ) -> WorkflowSession:
        """Extend session expiry time."""
        session = await cls.get_session(session_id, user)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        if session.status not in [SessionStatus.ACTIVE, SessionStatus.EXECUTING]:
            raise HTTPException(
                status_code=400, detail="Cannot extend inactive session"
            )

        # Calculate new expiry (respecting max duration)
        max_expiry = session.created_at + timedelta(
            minutes=cls.MAX_SESSION_DURATION_MINUTES
        )
        new_expiry = min(datetime.now() + timedelta(minutes=minutes), max_expiry)

        session.expires_at = new_expiry
        session.last_activity_at = datetime.now()
        await session.save()

        return session

    @classmethod
    async def mark_execution(cls, session_id: str) -> bool:
        """Mark session as executing and update activity."""
        session = await WorkflowSession.find_one(WorkflowSession.session_id == session_id)
        if not session:
            return False

        if session.is_expired():
            return False

        # Check execution limits
        if session.max_executions and session.execution_count >= session.max_executions:
            session.status = SessionStatus.COMPLETED
            await session.save()
            return False

        # Update session
        session.mark_activity()
        session.status = SessionStatus.EXECUTING

        # Auto-extend if close to expiry
        if (session.expires_at - datetime.now()).total_seconds() < 300:  # < 5 minutes
            session.extend_expiry(10)  # Extend by 10 minutes

        await session.save()
        return True

    @classmethod
    async def cleanup_session(cls, session_id: str, force: bool = False) -> bool:
        """Cleanup session and delete N8N workflow."""
        session = await WorkflowSession.find_one(WorkflowSession.session_id == session_id)
        if not session:
            return True  # Already cleaned up

        try:
            # Check if workflow is currently executing (unless forced)
            if not force and session.n8n_workflow_id:
                is_executing = await cls._check_workflow_executing(
                    session.n8n_workflow_id
                )
                if is_executing:
                    # Schedule retry in 5 minutes
                    session.cleanup_scheduled_at = datetime.now() + timedelta(minutes=5)
                    session.cleanup_attempts += 1
                    await session.save()
                    return False

            # Delete from N8N
            if session.n8n_workflow_id:
                await delete_deployed_workflow_from_n8n(session.n8n_workflow_id)

            # Delete session record
            await session.delete()
            return True

        except Exception as e:
            session.cleanup_attempts += 1
            session.status = SessionStatus.FAILED
            await session.save()
            print(f"Failed to cleanup session {session_id}: {e}")
            return False

    @classmethod
    async def _check_workflow_executing(cls, n8n_workflow_id: str) -> bool:
        """Check if N8N workflow has running executions."""
        try:
            response = requests.get(
                f"{N8N_SERVER_URL}/executions",
                headers=N8N_REQUEST_HEADERS,
                params={"workflowId": n8n_workflow_id, "status": "running", "limit": 1},
            )

            if response.status_code == 200:
                executions = response.json().get("data", [])
                return len(executions) > 0

        except Exception as e:
            print(f"Error checking workflow executions: {e}")

        return False  # Assume not executing if we can't check
