"""
Asset Notification RMQ Service - Handles asset modification notifications with dependency injection
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
import aio_pika
from .base_rmq_service import BaseRMQService
from .base_message_processor import BaseRMQMessageProcessor

logger = logging.getLogger(__name__)


class AssetNotificationRMQService(BaseRMQService):
    """RabbitMQ service for asset modification notifications"""

    def __init__(self, message_processor: BaseRMQMessageProcessor):
        super().__init__(message_processor)
        self.asset_notification_queue: Optional[aio_pika.abc.AbstractQueue] = None
        self.asset_exchange: Optional[aio_pika.abc.AbstractExchange] = None

    async def setup_infrastructure(self):
        """Setup asset notification exchanges, queues, and bindings"""
        try:
            channel = await self.get_channel()

            # Declare exchange for asset notifications
            self.asset_exchange = await channel.declare_exchange(
                "asset_exchange", aio_pika.ExchangeType.TOPIC, durable=True
            )

            # Declare queue for asset notifications
            self.asset_notification_queue = await channel.declare_queue(
                "asset_processing_queue", durable=True
            )

            # Bind queue to exchange with routing patterns
            # Examples: asset.created, asset.updated, asset.deleted
            await self.asset_notification_queue.bind(self.asset_exchange, "asset.*")

            logger.info("✅ Asset notification RMQ infrastructure setup complete")

        except Exception as e:
            logger.error(f"❌ Error setting up asset notification infrastructure: {e}")
            raise

    async def _start_consumer_with_processor(self):
        """Start consuming asset notifications using injected processor"""
        try:
            if not self.asset_notification_queue:
                await self.setup_infrastructure()

            # Start consuming messages with injected processor
            if self.asset_notification_queue:
                consumer_tag = await self.asset_notification_queue.consume(
                    self.message_processor
                )
                self.consumer_tags.append(consumer_tag)
                self.is_consuming = True

                logger.info(
                    f"🔄 Started consuming asset notifications with {self.message_processor.processor_name}"
                )
            else:
                raise Exception("Asset notification queue not available")

        except Exception as e:
            logger.error(f"❌ Error starting asset notification consumer: {e}")
            raise

    async def publish_asset_notification(
        self, notification_type: str, asset_data: Dict[str, Any]
    ):
        """Publish asset notification"""
        try:
            if not self.asset_exchange:
                await self.setup_infrastructure()

            # Create message
            message_id = str(uuid.uuid4())
            notification_data = {
                "notification_id": message_id,
                "type": notification_type,
                "asset_data": asset_data,
                "timestamp": datetime.now().isoformat(),
            }

            message_body = json.dumps(notification_data)

            message = aio_pika.Message(
                message_body.encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                message_id=message_id,
                timestamp=datetime.now(),
                headers={
                    "notification_type": notification_type,
                    "asset_id": asset_data.get("id"),
                },
            )

            # Publish with routing key pattern: asset.{type}
            routing_key = f"asset.{notification_type}"

            if self.asset_exchange:
                await self.asset_exchange.publish(message, routing_key=routing_key)
                logger.info(
                    f"📤 Published asset notification: {notification_type} for asset: {asset_data.get('id')}"
                )
            else:
                raise Exception("Asset exchange not available")

        except Exception as e:
            logger.error(f"❌ Error publishing asset notification: {e}")
            raise

    async def stop_consuming(self):
        """Stop consuming asset notifications"""
        self.is_consuming = False
        if self.asset_notification_queue and self.consumer_tags:
            for tag in self.consumer_tags:
                try:
                    await self.asset_notification_queue.cancel(tag)
                except Exception as e:
                    logger.warning(
                        f"Error cancelling asset notification consumer {tag}: {e}"
                    )
        await super().stop_consuming()
