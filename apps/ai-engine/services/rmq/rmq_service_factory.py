import logging
from .agent_rmq_service import AgentRMQService
from .asset_notification_rmq_service import AssetNotificationRMQService
from .agent_message_processor import agent_rmq_message_processor
from .asset_notification_message_processor import AssetNotificationRMQMessageProcessor
from .rmq_task_manager import rmq_task_manager

from loguru import logger


class RMQServiceFactory:
    """Factory for creating RMQ services with their dependencies"""

    def __init__(self):
        self._agent_service = None
        self._asset_notification_service = None

    def create_agent_service(self) -> AgentRMQService:
        """Create agent RMQ service with its message processor"""
        if self._agent_service is None:
            self._agent_service = AgentRMQService(agent_rmq_message_processor)
            logger.info("🏭 Created AgentRMQService with dependency injection")
        return self._agent_service

    def create_asset_notification_service(self) -> AssetNotificationRMQService:
        """Create asset notification RMQ service with its message processor"""
        if self._asset_notification_service is None:
            self._asset_notification_service = AssetNotificationRMQService(
                AssetNotificationRMQMessageProcessor()
            )
            logger.info(
                "🏭 Created AssetNotificationRMQService with dependency injection"
            )
        return self._asset_notification_service

    def register_all_services(self):
        """Register all services with the task manager"""
        # Create services with dependency injection
        agent_service = self.create_agent_service()
        asset_service = self.create_asset_notification_service()

        # Register with task manager
        rmq_task_manager.register_service("agents", agent_service)
        rmq_task_manager.register_service("asset_notifications", asset_service)

        logger.info("✅ All RMQ services registered with task manager")

    def get_agent_service(self) -> AgentRMQService:
        """Get the agent service instance"""
        if self._agent_service is None:
            self._agent_service = self.create_agent_service()
        return self._agent_service

    def get_asset_notification_service(self) -> AssetNotificationRMQService:
        """Get the asset notification service instance"""
        if self._asset_notification_service is None:
            self._asset_notification_service = self.create_asset_notification_service()
        return self._asset_notification_service


# Global factory instance
rmq_service_factory = RMQServiceFactory()
