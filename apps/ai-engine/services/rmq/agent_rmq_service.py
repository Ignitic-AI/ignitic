"""
Agent RMQ Service - Handles agent chat requests and responses with dependency injection
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Optional
import aio_pika
from .base_rmq_service import BaseRMQService
from .base_message_processor import BaseRMQMessageProcessor

from loguru import logger


class AgentRMQService(BaseRMQService):
    """RabbitMQ service specifically for agent chat functionality"""

    def __init__(self, message_processor: BaseRMQMessageProcessor):
        super().__init__(message_processor)
        self.request_queue: Optional[aio_pika.abc.AbstractQueue] = None
        self.response_queue: Optional[aio_pika.abc.AbstractQueue] = None
        self.exchange: Optional[aio_pika.abc.AbstractExchange] = None

    async def setup_infrastructure(self):
        """Setup agent-specific exchanges, queues, and bindings"""
        try:
            channel = await self.get_channel()

            # Declare exchange for agent communication
            self.exchange = await channel.declare_exchange(
                "agent_exchange", aio_pika.ExchangeType.DIRECT, durable=True
            )

            # Declare queues
            self.request_queue = await channel.declare_queue(
                "agent_request_queue", durable=True
            )
            self.response_queue = await channel.declare_queue(
                "agent_response_queue", durable=True
            )

            # Bind queues to exchange
            await self.request_queue.bind(self.exchange, "request")
            await self.response_queue.bind(self.exchange, "response")

            logger.info("✅ Agent RMQ infrastructure setup complete")

        except Exception as e:
            logger.error(f"❌ Error setting up agent infrastructure: {e}")
            raise

    async def _start_consumer_with_processor(self):
        """Start consuming agent requests using injected processor"""
        try:
            if not self.request_queue:
                await self.setup_infrastructure()

            # Start consuming messages with injected processor
            if self.request_queue:
                consumer_tag = await self.request_queue.consume(self.message_processor) # type: ignore
                self.consumer_tags.append(consumer_tag)
                self.is_consuming = True

                logger.info(
                    f"🔄 Started consuming agent requests with {self.message_processor.processor_name}"
                )
            else:
                raise Exception("Request queue not available")

        except Exception as e:
            logger.error(f"❌ Error starting agent consumer: {e}")
            raise

    async def publish_response(self, response_data: dict):
        """Publish agent response"""
        try:
            if not self.exchange:
                await self.setup_infrastructure()

            # Create message
            message_id = str(uuid.uuid4())
            message_body = json.dumps(response_data)

            message = aio_pika.Message(
                message_body.encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                message_id=message_id,
                timestamp=datetime.now(),
                headers={
                    "request_id": response_data.get("request_id"),
                    "status": response_data.get("status"),
                    "user_id": response_data.get("user_id"),
                },
            )

            # Publish message
            if self.exchange:
                await self.exchange.publish(message, routing_key="response")
                logger.info(
                    f"📤 Published agent response for request: {response_data.get('request_id')}"
                )
            else:
                raise Exception("Exchange not available")

        except Exception as e:
            logger.error(f"❌ Error publishing agent response: {e}")
            raise

    async def stop_consuming(self):
        """Stop consuming agent messages"""
        self.is_consuming = False
        if self.request_queue and self.consumer_tags:
            for tag in self.consumer_tags:
                try:
                    await self.request_queue.cancel(tag)
                except Exception as e:
                    logger.warning(f"Error cancelling agent consumer {tag}: {e}")
        await super().stop_consuming()
