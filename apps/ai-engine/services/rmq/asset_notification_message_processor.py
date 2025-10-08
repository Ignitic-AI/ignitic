"""
Asset Notification RMQ Message Processor - Handles asset modification notifications
"""

import json
import logging
from .base_message_processor import BaseRMQMessageProcessor

logger = logging.getLogger(__name__)


class AssetNotificationRMQMessageProcessor(BaseRMQMessageProcessor):
    """Message processor for asset modification notifications"""

    def __init__(self):
        super().__init__("AssetNotificationRMQMessageProcessor")

    async def process_message(self, message) -> None:
        """Process asset notification message"""
        try:
            notification_data = json.loads(message.body.decode("utf-8"))

            logger.info(
                f"📨 Processing asset notification: {notification_data.get('notification_id')}"
            )
            logger.info(f"   Type: {notification_data.get('type')}")
            logger.info(
                f"   Asset ID: {notification_data.get('asset_data', {}).get('id')}"
            )

            # Add your asset notification processing logic here
            # For example:
            # - Update search indexes
            # - Send webhooks
            # - Update caches
            # - Notify other services

            notification_type = notification_data.get("type")
            asset_data = notification_data.get("asset_data", {})

            if notification_type == "created":
                await self._handle_asset_created(asset_data)
            elif notification_type == "updated":
                await self._handle_asset_updated(asset_data)
            elif notification_type == "deleted":
                await self._handle_asset_deleted(asset_data)
            else:
                logger.warning(f"Unknown asset notification type: {notification_type}")

            await message.ack()
            logger.info(
                f"✅ Processed asset notification: {notification_data.get('notification_id')}"
            )

        except json.JSONDecodeError as e:
            logger.error(f"❌ Invalid JSON in asset notification: {e}")
            await message.reject(requeue=False)
        except Exception as e:
            logger.error(f"❌ Error processing asset notification: {e}")
            # Let the base class handle the error
            raise

    async def _handle_asset_created(self, asset_data: dict):
        """Handle asset creation notification"""
        logger.info(f"🆕 Asset created: {asset_data.get('id')}")
        # Implement asset creation handling logic
        # Example: Update search index, send webhook, etc.

    async def _handle_asset_updated(self, asset_data: dict):
        """Handle asset update notification"""
        logger.info(f"📝 Asset updated: {asset_data.get('id')}")
        # Implement asset update handling logic
        # Example: Update search index, invalidate cache, etc.

    async def _handle_asset_deleted(self, asset_data: dict):
        """Handle asset deletion notification"""
        logger.info(f"🗑️ Asset deleted: {asset_data.get('id')}")
        # Implement asset deletion handling logic
        # Example: Remove from search index, cleanup related data, etc.


# Global instance
asset_notification_rmq_message_processor = AssetNotificationRMQMessageProcessor()
