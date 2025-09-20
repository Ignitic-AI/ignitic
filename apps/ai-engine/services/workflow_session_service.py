from unittest.mock import DEFAULT
import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException
from models.automations.workflow_session import WorkflowSession, SessionStatus
from models.user import User
from core.auth import AuthProvider
from services.workflow_template_service import WorkflowTemplateService
from services.workflow_service import WorkflowService


class WorkflowSessionService:
    """Service for managing ephemeral workflow sessions."""

    DEFAULT_SESSION_DURATION_MINUTES = 5

    def __init__(self, auth: AuthProvider) -> None:
        self._auth = auth

    async def create_session(
        self, template_id: Optional[str], ignitic_identifier: Optional[str]
    ) -> WorkflowSession:
        """
        Create a new workflow session by deploying a workflow template.

        Args:
            template_id: Workflow template ID or ignitic_identifier

        Returns:
            WorkflowSession: Created session with webhook URL
        """
        try:
            user = self._auth.get_user()
            template = await WorkflowTemplateService(self._auth).get_workflow_template(
                id=template_id, ignitic_identifier=ignitic_identifier
            )

            # Create session record
            session = WorkflowSession(
                template_id=str(template.id),
                ignitic_identifier=template.ignitic_identifier,
                status=SessionStatus.CREATING,
                expires_at=datetime.now() + timedelta(minutes=self.DEFAULT_SESSION_DURATION_MINUTES),
                u_id=user.id,
                org_id=user.org_id,
                active_executions_count=0
            )

            deployed_workflow = await WorkflowService(self._auth).create_deployed_workflow(template)

            session.workflow_id = str(deployed_workflow.id)

            # Save initial session
            await session.insert()

            return session

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to create session: {str(e)}"
            )

    # @classmethod
    # async def _deploy_session_workflow(
    #     self, session: WorkflowSession, template: WorkflowTemplate, user: User
    # ):
    #     """Deploy workflow for the session."""
    #     try:

    #         if N8N_SERVER_URL is None:
    #             session.status = SessionStatus.FAILED
    #             await session.save()
    #             raise ValueError("N8N server URL is not configured")

    #         if template.workflow_type == "n8n":
    #             if not isinstance(template, N8NWorkflowTemplate):
    #                 raise ValueError("Template is not an N8N workflow template")

    #             # Generate unique webhook ID
    #             webhook_id = str(uuid.uuid4())
    #             template.n8n_json.nodes[0].webhookId = webhook_id
    #             template.n8n_json.nodes[0].parameters["path"] = (
    #                 f"workflow-session/{session.session_id}"
    #             )

    #             # Deploy to N8N
    #             n8n_id = await deploy_workflow_on_n8n(template, user)

    #             # Activate workflow
    #             activated = await activate_workflow(n8n_id)
    #             if not activated:
    #                 # Cleanup failed deployment
    #                 await delete_deployed_workflow_from_n8n(n8n_id)
    #                 session.status = SessionStatus.FAILED
    #                 await session.save()
    #                 raise ValueError("Failed to activate deployed workflow")

    #             # Update session with deployment details
    #             session.n8n_workflow_id = n8n_id
    #             session.webhook_url = parse_obj_as(
    #                 HttpUrl,
    #                 f"{get_base_url(N8N_SERVER_URL)}/webhook/workflow-session/{session.session_id}",
    #             )
    #             session.status = SessionStatus.ACTIVE
    #             await session.save()

    #         else:
    #             raise ValueError(f"Unsupported workflow type: {template.workflow_type}")

    #     except Exception as e:
    #         session.status = SessionStatus.FAILED
    #         await session.save()
    #         raise e


    # async def get_session(
    #     self, session_id: str, user: User
    # ) -> Optional[WorkflowSession]:
    #     """Get session by ID with user access check."""
    #     from beanie.operators import Or, And

    #     session = await WorkflowSession.find_one(
    #         And(
    #             WorkflowSession.session_id == session_id,
    #             Or(
    #                 WorkflowSession.u_id == user.id,
    #                 WorkflowSession.org_id == user.org_id,
    #             ),
    #         )
    #     )

    #     if session and session.is_expired() and session.status == SessionStatus.ACTIVE:
    #         session.status = SessionStatus.EXPIRED
    #         await session.save()

    #     return session

    # @classmethod
    # async def extend_session(
    #     self, session_id: str, user: User, minutes: int = 15
    # ) -> WorkflowSession:
    #     """Extend session expiry time."""
    #     session = await self.get_session(session_id, user)
    #     if not session:
    #         raise HTTPException(status_code=404, detail="Session not found")

    #     if session.status not in [SessionStatus.ACTIVE, SessionStatus.EXECUTING]:
    #         raise HTTPException(
    #             status_code=400, detail="Cannot extend inactive session"
    #         )

    #     # Calculate new expiry (respecting max duration)
    #     max_expiry = session.created_at + timedelta(
    #         minutes=self.MAX_SESSION_DURATION_MINUTES
    #     )
    #     new_expiry = min(datetime.now() + timedelta(minutes=minutes), max_expiry)

    #     session.expires_at = new_expiry
    #     session.last_activity_at = datetime.now()
    #     await session.save()

    #     return session

    # @classmethod
    # async def mark_execution(self, session_id: str) -> bool:
    #     """Mark session as executing and update activity."""
    #     session = await WorkflowSession.find_one(WorkflowSession.session_id == session_id)
    #     if not session:
    #         return False

    #     if session.is_expired():
    #         return False

    #     # Check execution limits
    #     if session.max_executions and session.execution_count >= session.max_executions:
    #         session.status = SessionStatus.COMPLETED
    #         await session.save()
    #         return False

    #     # Update session
    #     session.mark_activity()
    #     session.status = SessionStatus.EXECUTING

    #     # Auto-extend if close to expiry
    #     if (session.expires_at - datetime.now()).total_seconds() < 300:  # < 5 minutes
    #         session.extend_expiry(10)  # Extend by 10 minutes

    #     await session.save()
    #     return True

    # @classmethod
    # async def cleanup_session(self, session_id: str, force: bool = False) -> bool:
    #     """Cleanup session and delete N8N workflow."""
    #     session = await WorkflowSession.find_one(WorkflowSession.session_id == session_id)
    #     if not session:
    #         return True  # Already cleaned up

    #     try:
    #         # Check if workflow is currently executing (unless forced)
    #         if not force and session.n8n_workflow_id:
    #             is_executing = await self._check_workflow_executing(
    #                 session.n8n_workflow_id
    #             )
    #             if is_executing:
    #                 # Schedule retry in 5 minutes
    #                 session.cleanup_scheduled_at = datetime.now() + timedelta(minutes=5)
    #                 session.cleanup_attempts += 1
    #                 await session.save()
    #                 return False

    #         # Delete from N8N
    #         if session.n8n_workflow_id:
    #             await delete_deployed_workflow_from_n8n(session.n8n_workflow_id)

    #         # Delete session record
    #         await session.delete()
    #         return True

    #     except Exception as e:
    #         session.cleanup_attempts += 1
    #         session.status = SessionStatus.FAILED
    #         await session.save()
    #         print(f"Failed to cleanup session {session_id}: {e}")
    #         return False

    # @classmethod
    # async def _check_workflow_executing(self, n8n_workflow_id: str) -> bool:
    #     """Check if N8N workflow has running executions."""
    #     try:
    #         response = requests.get(
    #             f"{N8N_SERVER_URL}/executions",
    #             headers=N8N_REQUEST_HEADERS,
    #             params={"workflowId": n8n_workflow_id, "status": "running", "limit": 1},
    #         )

    #         if response.status_code == 200:
    #             executions = response.json().get("data", [])
    #             return len(executions) > 0

    #     except Exception as e:
    #         print(f"Error checking workflow executions: {e}")

    #     return False  # Assume not executing if we can't check
