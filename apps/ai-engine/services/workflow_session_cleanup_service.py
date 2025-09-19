import asyncio
from datetime import datetime, timedelta
from models.automations.workflow_session import WorkflowSession, SessionStatus
from services.workflow_session_service import WorkflowSessionService
import logging

logger = logging.getLogger(__name__)


class WorkflowSessionCleanupService:
    """Background service for cleaning up expired Workflow sessions."""

    @classmethod
    async def cleanup_expired_sessions(cls) -> int:
        """
        Cleanup expired sessions.

        Returns:
            int: Number of sessions cleaned up
        """
        cleaned_count = 0

        try:
            # Find expired sessions
            expired_sessions = await WorkflowSession.find(
                WorkflowSession.expires_at < datetime.now(),
                WorkflowSession.status.in_(
                    [
                        SessionStatus.ACTIVE,
                        SessionStatus.EXECUTING,
                        SessionStatus.EXPIRED,
                    ]
                ),
            ).to_list()

            logger.info(f"Found {len(expired_sessions)} expired sessions to cleanup")

            # Cleanup each session
            for session in expired_sessions:
                try:
                    # Update status first
                    session.status = SessionStatus.CLEANING_UP
                    await session.save()

                    # Attempt cleanup
                    success = await WorkflowSessionService.cleanup_session(
                        session.session_id, force=False
                    )

                    if success:
                        cleaned_count += 1
                        logger.info(
                            f"Successfully cleaned up session {session.session_id}"
                        )
                    else:
                        logger.warning(
                            f"Cleanup delayed for session {session.session_id} (workflow executing)"
                        )

                except Exception as e:
                    logger.error(f"Error cleaning up session {session.session_id}: {e}")

            return cleaned_count

        except Exception as e:
            logger.error(f"Error in cleanup_expired_sessions: {e}")
            return cleaned_count

    @classmethod
    async def force_cleanup_old_sessions(cls, hours_old: int = 24) -> int:
        """
        Force cleanup very old sessions regardless of status.

        Args:
            hours_old: Sessions older than this will be force cleaned

        Returns:
            int: Number of sessions force cleaned
        """
        cleaned_count = 0
        cutoff_time = datetime.now() - timedelta(hours=hours_old)

        try:
            old_sessions = await WorkflowSession.find(
                WorkflowSession.created_at < cutoff_time,
                WorkflowSession.status != SessionStatus.COMPLETED,
            ).to_list()

            logger.info(
                f"Force cleaning {len(old_sessions)} sessions older than {hours_old} hours"
            )

            for session in old_sessions:
                try:
                    success = await WorkflowSessionService.cleanup_session(
                        session.session_id, force=True
                    )

                    if success:
                        cleaned_count += 1
                        logger.info(f"Force cleaned session {session.session_id}")

                except Exception as e:
                    logger.error(
                        f"Error force cleaning session {session.session_id}: {e}"
                    )

            return cleaned_count

        except Exception as e:
            logger.error(f"Error in force_cleanup_old_sessions: {e}")
            return cleaned_count

    @classmethod
    async def retry_failed_cleanups(cls) -> int:
        """
        Retry cleanup for sessions that had failed cleanup attempts.

        Returns:
            int: Number of retries attempted
        """
        retry_count = 0

        try:
            # Find sessions scheduled for cleanup retry
            retry_sessions = await WorkflowSession.find(
                WorkflowSession.cleanup_scheduled_at < datetime.now(),
                WorkflowSession.cleanup_attempts < 5,  # Max 5 attempts
                WorkflowSession.status == SessionStatus.CLEANING_UP,
            ).to_list()

            logger.info(f"Retrying cleanup for {len(retry_sessions)} sessions")

            for session in retry_sessions:
                try:
                    success = await WorkflowSessionService.cleanup_session(
                        session.session_id,
                        force=session.cleanup_attempts >= 3,  # Force after 3 attempts
                    )

                    retry_count += 1

                    if success:
                        logger.info(
                            f"Successfully retried cleanup for session {session.session_id}"
                        )
                    else:
                        logger.warning(
                            f"Cleanup retry failed for session {session.session_id}"
                        )

                except Exception as e:
                    logger.error(
                        f"Error retrying cleanup for session {session.session_id}: {e}"
                    )

            return retry_count

        except Exception as e:
            logger.error(f"Error in retry_failed_cleanups: {e}")
            return retry_count

    @classmethod
    async def get_cleanup_stats(cls) -> dict:
        """Get statistics about sessions and cleanup status."""
        try:
            stats = {}

            # Count by status
            for status in SessionStatus:
                count = await WorkflowSession.find(WorkflowSession.status == status).count()
                stats[f"{status.value}_count"] = count

            # Expired but not cleaned
            expired_count = await WorkflowSession.find(
                WorkflowSession.expires_at < datetime.now(),
                WorkflowSession.status.in_([SessionStatus.ACTIVE, SessionStatus.EXECUTING]),
            ).count()
            stats["expired_pending_cleanup"] = expired_count

            # Old sessions (>24h)
            old_cutoff = datetime.now() - timedelta(hours=24)
            old_count = await WorkflowSession.find(
                WorkflowSession.created_at < old_cutoff,
                WorkflowSession.status != SessionStatus.COMPLETED,
            ).count()
            stats["old_sessions_count"] = old_count

            # Failed cleanups
            failed_cleanup_count = await WorkflowSession.find(
                WorkflowSession.cleanup_attempts > 0,
                WorkflowSession.status != SessionStatus.COMPLETED,
            ).count()
            stats["failed_cleanup_count"] = failed_cleanup_count

            return stats

        except Exception as e:
            logger.error(f"Error getting cleanup stats: {e}")
            return {"error": str(e)}


# Background task runner
async def run_cleanup_task():
    """Run the cleanup task continuously."""
    cleanup_service = WorkflowSessionCleanupService()

    while True:
        try:
            logger.info("Starting Workflow session cleanup cycle")

            # Regular cleanup
            cleaned = await cleanup_service.cleanup_expired_sessions()

            # Retry failed cleanups
            retried = await cleanup_service.retry_failed_cleanups()

            # Force cleanup very old sessions (once per hour)
            if datetime.now().minute == 0:  # Run on the hour
                force_cleaned = await cleanup_service.force_cleanup_old_sessions(
                    hours_old=24
                )
                logger.info(
                    f"Cleanup cycle complete: {cleaned} cleaned, {retried} retried, {force_cleaned} force cleaned"
                )
            else:
                logger.info(
                    f"Cleanup cycle complete: {cleaned} cleaned, {retried} retried"
                )

            # Wait 5 minutes before next cycle
            await asyncio.sleep(300)

        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")
            await asyncio.sleep(60)  # Wait 1 minute on error
