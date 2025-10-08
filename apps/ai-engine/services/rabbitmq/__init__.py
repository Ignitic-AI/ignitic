"""
RMQ Services Package - Dependency Injection Architecture
"""

from .base_rmq_service import BaseRMQService
from .base_message_processor import BaseRMQMessageProcessor
from .agent_rmq_service import AgentRMQService
from .asset_notification_rmq_service import AssetNotificationRMQService
from .agent_message_processor import (
    agent_rmq_message_processor,
    AgentRMQMessageProcessor,
)
from .asset_notification_message_processor import (
    asset_notification_rmq_message_processor,
    AssetNotificationRMQMessageProcessor,
)
from .rmq_task_manager import rmq_task_manager, RMQTaskManager
from .rmq_service_factory import rmq_service_factory, RMQServiceFactory

__all__ = [
    "BaseRMQService",
    "BaseRMQMessageProcessor",
    "AgentRMQService",
    "AssetNotificationRMQService",
    "AgentRMQMessageProcessor",
    "AssetNotificationRMQMessageProcessor",
    "agent_rmq_message_processor",
    "asset_notification_rmq_message_processor",
    "rmq_task_manager",
    "RMQTaskManager",
    "rmq_service_factory",
    "RMQServiceFactory",
]
