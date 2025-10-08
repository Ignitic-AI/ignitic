"""
Fixed RabbitMQ Service - Addresses critical async/event loop issues
"""

import json
import logging
import os
from typing import Dict, Any, Optional, Callable
import aio_pika
import aio_pika.abc
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)


class RabbitMQService:
    def __init__(self):
        self.connection: aio_pika.abc.AbstractRobustConnection
        self.channel: aio_pika.abc.AbstractChannel
        self.request_queue: aio_pika.abc.AbstractQueue
        self.response_queue: aio_pika.abc.AbstractQueue
        self.exchange: aio_pika.abc.AbstractExchange
        self.is_consuming = False
        self.consumer_tag: Optional[str]

        # RabbitMQ connection parameters
        self.rabbitmq_url = os.getenv(
            "RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"
        )

    async def connect(self) -> bool:
        """Connect to RabbitMQ using async client"""
        try:
            # Use async connection
            self.connection = await aio_pika.connect_robust(self.rabbitmq_url)
            self.channel = await self.connection.channel()

            # Set QoS for better performance
            await self.channel.set_qos(prefetch_count=10)

            # Declare exchange
            self.exchange = await self.channel.declare_exchange(
                "agent_exchange", aio_pika.ExchangeType.DIRECT, durable=True
            )

            # Declare queues
            self.request_queue = await self.channel.declare_queue(
                "agent_request_queue", durable=True
            )
            self.response_queue = await self.channel.declare_queue(
                "agent_response_queue", durable=True
            )

            # Bind queues to exchange
            await self.request_queue.bind(self.exchange, "request")
            await self.response_queue.bind(self.exchange, "response")

            logger.info("✅ RabbitMQ connected successfully")
            return True

        except Exception as e:
            logger.error(f"❌ RabbitMQ connection failed: {e}")
            return False

    async def start_consuming(self, process_callback: Callable):
        """Start consuming from request queue"""
        try:
            if not self.connection or self.connection.is_closed:
                await self.connect()

            if not self.request_queue:
                logger.error("❌ Cannot start consuming: No queue available")
                return

            # Set up async consumer
            self.consumer_tag = await self.request_queue.consume(process_callback)

            logger.info("🔄 Started consuming from agent_request_queue")
            self.is_consuming = True

        except Exception as e:
            logger.error(f"❌ Error consuming messages: {e}")
            raise

    async def publish_response(self, response_data: Dict[str, Any]):
        """Publish response to response queue"""
        try:
            if not self.connection or self.connection.is_closed:
                logger.warning("🔄 Connection lost, reconnecting...")
                await self.connect()

            if not self.exchange:
                logger.error("❌ Cannot publish response: No exchange available")
                return

            # Create message with detailed logging
            message_id = str(uuid.uuid4())
            message_body = json.dumps(response_data)

            logger.info("📝 Preparing message for queue:")
            logger.info(f"   - Message ID: {message_id}")
            logger.info(f"   - Request ID: {response_data.get('request_id')}")
            logger.info(f"   - Body size: {len(message_body)} bytes")
            logger.info(
                f"   - Exchange: {self.exchange.name if hasattr(self.exchange, 'name') else 'agent_exchange'}"
            )
            logger.info("   - Routing key: response")

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

            # Publish with confirmation
            result = await self.exchange.publish(message, routing_key="response")

            # Check if message was confirmed
            if result and hasattr(result, "delivery_tag"):
                logger.info(
                    f"✅ Message confirmed by broker - Delivery tag: {result.delivery_tag}"
                )
            else:
                logger.info("✅ Message published (no delivery confirmation)")

            # Log queue state if possible
            try:
                # Simple logging without specific queue counts
                logger.info("📊 Message published to agent_response_queue")
            except Exception as queue_err:
                logger.debug(f"Could not get queue info: {queue_err}")

            logger.info(
                f"📤 Successfully published response for request: {response_data.get('request_id')}"
            )

        except Exception as e:
            logger.error(f"❌ Error publishing response: {e}")
            logger.error(
                f"   - Connection status: {'Open' if self.connection and not self.connection.is_closed else 'Closed'}"
            )
            logger.error(f"   - Exchange available: {self.exchange is not None}")
            import traceback

            logger.error(f"   - Traceback: {traceback.format_exc()}")
            raise

    async def debug_queue_status(self):
        """Debug method to check queue status and message counts"""
        try:
            if not self.connection or self.connection.is_closed:
                logger.info("🔄 Connection not available for debug check")
                return

            logger.info("🔍 === RabbitMQ Queue Debug Status ===")

            # Check connection status
            logger.info(
                f"   Connection status: {'Open' if self.connection and not self.connection.is_closed else 'Closed'}"
            )
            logger.info(f"   Channel available: {self.channel is not None}")
            logger.info(f"   Exchange available: {self.exchange is not None}")
            logger.info(f"   Request queue available: {self.request_queue is not None}")
            logger.info(
                f"   Response queue available: {self.response_queue is not None}"
            )

            # Try to get queue information using management API if available
            try:
                # Redeclare queues to get current state (passive=True means don't create)
                if self.channel:
                    await self.channel.declare_queue(
                        "agent_request_queue", passive=True
                    )
                    await self.channel.declare_queue(
                        "agent_response_queue", passive=True
                    )
                    logger.info("   ✅ Queues exist and are accessible")
                else:
                    logger.warning("   ⚠️ No channel available for queue check")
            except Exception as e:
                logger.warning(f"   ⚠️ Could not access queue info: {e}")

            logger.info("🔍 === End Debug Status ===")

        except Exception as e:
            logger.error(f"❌ Debug status check failed: {e}")

    async def test_publish_simple_message(self):
        """Test method to publish a simple test message"""
        try:
            test_data = {
                "request_id": "test-" + str(uuid.uuid4()),
                "response": "Test message from debug",
                "status": "test",
                "user_id": "debug-user",
                "timestamp": datetime.now().isoformat(),
            }

            logger.info("🧪 Publishing test message...")
            await self.publish_response(test_data)
            logger.info("✅ Test message publishing completed")

        except Exception as e:
            logger.error(f"❌ Test message publishing failed: {e}")

    async def stop_consuming(self):
        """Stop consuming messages"""
        self.is_consuming = False
        if self.request_queue and self.consumer_tag:
            await self.request_queue.cancel(self.consumer_tag)
        logger.info("🛑 Stopping RabbitMQ consumer")

    async def close(self):
        """Close RabbitMQ connection"""
        try:
            await self.stop_consuming()
            if self.connection and not self.connection.is_closed:
                await self.connection.close()
                logger.info("🔌 RabbitMQ connection closed")
        except Exception as e:
            logger.error(f"❌ Error closing RabbitMQ connection: {e}")


# Global instance
rabbitmq_service = RabbitMQService()
