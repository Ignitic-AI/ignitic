"""
Base RMQ Service - Shared connection and common functionality with dependency injection
"""

import logging
import os
from typing import Optional
import aio_pika
import aio_pika.abc
from .base_message_processor import BaseRMQMessageProcessor

logger = logging.getLogger(__name__)


class BaseRMQService:
    """Base class for all RabbitMQ services - manages shared connection and message processing"""

    _connection: Optional[aio_pika.abc.AbstractRobustConnection] = None
    _connection_lock = None
    _rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

    def __init__(self, message_processor: BaseRMQMessageProcessor):
        self.channel: Optional[aio_pika.abc.AbstractChannel] = None
        self.is_consuming = False
        self.consumer_tags: list = []
        self.message_processor = message_processor
        logger.info(
            f"🔧 Initialized {self.__class__.__name__} with processor: {message_processor.processor_name}"
        )

    @classmethod
    async def get_connection(cls) -> aio_pika.abc.AbstractRobustConnection:
        """Get shared connection instance (singleton pattern)"""
        if cls._connection is None or cls._connection.is_closed:
            cls._connection = await aio_pika.connect_robust(cls._rabbitmq_url)
            logger.info("✅ RabbitMQ shared connection established")
        return cls._connection

    async def get_channel(self) -> aio_pika.abc.AbstractChannel:
        """Get a new channel for this service"""
        if self.channel is None or self.channel.is_closed:
            connection = await self.get_connection()
            self.channel = await connection.channel()
            await self.channel.set_qos(prefetch_count=10)
            logger.info(f"✅ New channel created for {self.__class__.__name__}")
        return self.channel

    async def setup_infrastructure(self):
        """Override this method to setup exchanges, queues, and bindings"""
        raise NotImplementedError("Subclasses must implement setup_infrastructure")

    async def start_consuming(self, *args, **kwargs):
        """Start consuming messages using the injected message processor"""
        try:
            if not self.channel:
                await self.setup_infrastructure()

            # Use the injected message processor as callback
            await self._start_consumer_with_processor()

        except Exception as e:
            logger.error(
                f"❌ Error starting consumer for {self.__class__.__name__}: {e}"
            )
            raise

    async def _start_consumer_with_processor(self):
        """Override this method to implement service-specific consuming logic"""
        raise NotImplementedError(
            "Subclasses must implement _start_consumer_with_processor"
        )

    async def stop_consuming(self):
        """Stop all consumers for this service"""
        self.is_consuming = False
        # Consumer cancellation will be handled by the specific service implementations
        # as they have access to the actual queue objects
        self.consumer_tags.clear()
        logger.info(f"🛑 Stopped consuming for {self.__class__.__name__}")

    async def close_channel(self):
        """Close this service's channel"""
        try:
            await self.stop_consuming()
            if self.channel and not self.channel.is_closed:
                await self.channel.close()
                logger.info(f"🔌 Channel closed for {self.__class__.__name__}")
        except Exception as e:
            logger.error(f"❌ Error closing channel for {self.__class__.__name__}: {e}")

    @classmethod
    async def close_shared_connection(cls):
        """Close the shared connection (call this on app shutdown)"""
        try:
            if cls._connection and not cls._connection.is_closed:
                await cls._connection.close()
                logger.info("🔌 RabbitMQ shared connection closed")
        except Exception as e:
            logger.error(f"❌ Error closing shared connection: {e}")
