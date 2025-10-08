"""
Base RMQ Message Processor - Abstract base for all RabbitMQ message processors
"""

import logging
from abc import ABC, abstractmethod
from typing import Any, Optional

logger = logging.getLogger(__name__)


class BaseRMQMessageProcessor(ABC):
    """Base class for all RabbitMQ message processors"""

    def __init__(self, processor_name: Optional[str] = None):
        self.processor_name = processor_name or self.__class__.__name__
        logger.info(f"📝 Initialized message processor: {self.processor_name}")

    @abstractmethod
    async def process_message(self, message: Any) -> None:
        """
        Process incoming RabbitMQ message

        Args:
            message: RabbitMQ message object

        Raises:
            NotImplementedError: Must be implemented by subclasses
        """
        raise NotImplementedError("Subclasses must implement process_message method")

    async def handle_processing_error(self, message: Any, error: Exception) -> None:
        """
        Handle processing errors - can be overridden by subclasses

        Args:
            message: RabbitMQ message that failed processing
            error: Exception that occurred during processing
        """
        logger.error(f"❌ Error in {self.processor_name}: {error}")

        # Default behavior: reject and don't requeue to avoid infinite loops
        try:
            await message.reject(requeue=False)
            logger.info("🚫 Message rejected (no requeue) due to processing error")
        except Exception as reject_error:
            logger.error(f"❌ Failed to reject message: {reject_error}")

    async def __call__(self, message: Any) -> None:
        """
        Callable interface for RabbitMQ consumer callback

        Args:
            message: RabbitMQ message object
        """
        try:
            logger.debug(f"🔄 {self.processor_name} processing message")
            await self.process_message(message)
        except Exception as e:
            await self.handle_processing_error(message, e)
