from datetime import datetime, timedelta
from typing import Optional
from beanie import PydanticObjectId
from fastapi import HTTPException
from models.automations.workflow_session import WorkflowSession, SessionStatus
from models.user import User
from core.auth import AuthProvider
from services.workflow_template_service import WorkflowTemplateService
from services.workflow_service import WorkflowService
from beanie.operators import Or, And, In
import logging


from loguru import logger


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
            logger.info(
                f"Creating workflow session for user {user.id}, org {user.org_id}, template_id={template_id}, ignitic_identifier={ignitic_identifier}"
            )
            template = await WorkflowTemplateService(self._auth).get_workflow_template(
                id=template_id, ignitic_identifier=ignitic_identifier
            )

            logger.info(
                f"Workflow template retrieved: template_id={template.id}, ignitic_identifier={template.ignitic_identifier}"
            )

            # Create session record
            session = WorkflowSession(
                template_id=str(template.id),
                ignitic_identifier=template.ignitic_identifier,
                status=SessionStatus.CREATING,
                expires_at=datetime.now()
                + timedelta(minutes=self.DEFAULT_SESSION_DURATION_MINUTES),
                u_id=user.id,
                org_id=user.org_id,
                active_executions_count=0,
            )

            logger.info(f"Deploying workflow for session {session.template_id}")
            deployed_workflow = await WorkflowService(
                self._auth
            ).create_deployed_workflow(template)

            session.workflow_id = str(deployed_workflow.id)
            session.workflow_url = (
                str(deployed_workflow.webhook_url)
                if deployed_workflow.webhook_url
                else None
            )
            session.status = SessionStatus.ACTIVE

            await session.insert()
            logger.info(
                f"Session created and inserted: session_id={session.id}, workflow_id={session.workflow_id}"
            )
            return session

        except HTTPException as e:
            logger.error(
                f"HTTPException during session creation: {ignitic_identifier}: {str(e)}"
            )
            raise
        except Exception as e:
            logger.error(f"Failed to create session: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to create session: {str(e)}"
            )

    async def resolve(
        self, template_id: Optional[str], ignitic_identifier: Optional[str]
    ) -> WorkflowSession:
        """Creates a new or gets an existing active session for the user."""
        logger.info(
            f"Resolving session for template_id={template_id}, ignitic_identifier={ignitic_identifier}"
        )
        existing_session = await self.get_session(
            template_id=template_id, ignitic_identifier=ignitic_identifier
        )
        if existing_session:
            logger.info(
                f"Found existing session {existing_session.id}, extending expiry."
            )
            existing_session.expires_at = datetime.now() + timedelta(
                minutes=self.DEFAULT_SESSION_DURATION_MINUTES
            )
            return existing_session
        else:
            logger.info("No existing session found, creating new session.")
            return await self.create_session(
                template_id=template_id, ignitic_identifier=ignitic_identifier
            )

    async def get_session(
        self, template_id: Optional[str], ignitic_identifier: Optional[str]
    ) -> Optional[WorkflowSession]:
        """Get session by ID with user access check."""
        user = self._auth.get_user()
        logger.info(
            f"Getting session for user {user.id}, org {user.org_id}, template_id={template_id}, ignitic_identifier={ignitic_identifier}"
        )
        session = await WorkflowSession.find_one(
            And(
                Or(
                    WorkflowSession.template_id == template_id,
                    WorkflowSession.ignitic_identifier == ignitic_identifier,
                ),
                WorkflowSession.u_id == user.id,
                WorkflowSession.org_id == user.org_id,
                In(
                    WorkflowSession.status,
                    [SessionStatus.ACTIVE, SessionStatus.EXECUTING],
                ),
            )
        )

        if session:
            if (
                session.status == SessionStatus.ACTIVE
                and session.expires_at < datetime.now()
            ):
                logger.info(f"Session {session.id} expired, cleaning up.")
                await self.cleanup_session(str(session.id))
                return None
            logger.info(f"Session {session.id} is valid and active/executing.")
            return session

    async def cleanup_session(self, session_id: str):
        """Cleanup session and delete N8N workflow."""
        logger.info(f"Cleaning up session {session_id}")
        session = await WorkflowSession.find_one(
            WorkflowSession.id == PydanticObjectId(session_id)
        )
        if not session:
            raise HTTPException(status_code=500, detail="Session not found")

        if session.status == SessionStatus.CLEANING_UP:
            logger.info(f"Session {session_id} already cleaning up")
            raise HTTPException(status_code=200, detail="Session already cleaning up")

        if session.status == SessionStatus.EXPIRED:
            logger.info(f"Session {session_id} already expired.")
            raise HTTPException(status_code=200, detail="Session already expired")

        try:
            session.status = SessionStatus.CLEANING_UP
            await session.save()
            logger.info(f"Session {session_id} marked as CLEANING_UP.")
            if session.workflow_id:
                if (
                    session.status == SessionStatus.EXECUTING
                    and session.active_executions_count > 0
                ) or session.status == SessionStatus.CREATING:
                    logger.warning(
                        f"Session {session_id} is EXECUTING or CREATING, skipping workflow deletion."
                    )
                    raise HTTPException(
                        status_code=400, detail="Session is busy, cannot clean up now."
                    )

            if session.workflow_id:
                logger.info(
                    f"Deleting deployed workflow {session.workflow_id} for session {session_id}"
                )
                await WorkflowService(self._auth).delete_deployed_workflow(
                    session.workflow_id
                )

            session.status = SessionStatus.EXPIRED
            await session.save()
            logger.info(f"Session {session_id} marked as EXPIRED.")

        finally:
            if session.status == SessionStatus.CLEANING_UP:
                session.status = SessionStatus.ACTIVE
                await session.save()
