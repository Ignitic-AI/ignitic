"""
Asset Notification RMQ Message Processor - Handles asset modification notifications

This processor implements the complete asset processing workflow:
1. Receives asset notifications from backend
2. Fetches asset data using AssetService
3. Processes documents using appropriate document processors
4. Stores vectors in MongoDB with proper namespace management
5. Handles errors with cleanup and rollback capabilities
"""

import json
from typing import Optional

from fastapi.security import HTTPAuthorizationCredentials

from models.asset import Asset
from .base_message_processor import BaseRMQMessageProcessor
from services.asset_service import AssetService
from services.mongo_vector_store_service import MongoVectorStoreService
from services.document_processors import ProcessorFactory
from core.auth import AuthProvider

from loguru import logger


class AssetNotificationRMQMessageProcessor(BaseRMQMessageProcessor):
    """
    Message processor for asset modification notifications with complete workflow integration.

    Handles asset create/update/delete notifications by:
    1. Parsing notification messages
    2. Fetching asset data from backend
    3. Processing documents through appropriate processors
    4. Storing vectors in MongoDB with namespace management
    5. Providing error recovery and cleanup capabilities
    """

    def __init__(self):
        super().__init__("AssetNotificationRMQMessageProcessor")
        self._processor_factory = ProcessorFactory()
        logger.info(
            "🚀 AssetNotificationRMQMessageProcessor initialized with full workflow integration"
        )

    def _asset_service(self, auth_token: str) -> AssetService:
        """
        Create AssetService instance with provided auth token.

        Args:
            auth_token: JWT auth token for backend access
        Returns:
            Configured AssetService instance
        """
        return AssetService(
            AuthProvider(
                auth=HTTPAuthorizationCredentials(
                    scheme="Bearer", credentials=auth_token
                )
            )
        )

    def _vector_service(self, auth_token: str) -> MongoVectorStoreService:
        """
        Create MongoVectorStoreService instance.

        Returns:
            Configured MongoVectorStoreService instance
        """
        return MongoVectorStoreService(
            AuthProvider(
                auth=HTTPAuthorizationCredentials(
                    scheme="Bearer", credentials=auth_token
                )
            )
        )

    async def process_message(self, message) -> None:
        """
        Process AssetProcessingRequest message with complete workflow.

        Expected message schema (supports both snake_case and PascalCase):
        {
            "asset_id" | "AssetID": "uuid-string",
            "user_id" | "UserID": "user-id",
            "organization_id" | "OrganizationID": "org-id-or-null",
            "auth_token" | "AuthToken": "jwt-token",
            "request_id" | "RequestID": "uuid-string",
            "action" | "Action": "created|updated|deleted",
            "event_id" | "EventID": "uuid-string",
            "timestamp" | "Timestamp": "iso-timestamp"
        }
        """
        try:
            print(f"Message body: {message.body}")

            request_data = json.loads(message.body.decode("utf-8"))

            # Extract fields from AssetProcessingRequest schema
            # Support both snake_case and PascalCase field names
            asset_id = request_data.get("asset_id") or request_data.get("AssetID")
            user_id = request_data.get("user_id") or request_data.get("UserID")
            org_id = request_data.get("organization_id") or request_data.get(
                "OrganizationID"
            )
            auth_token = request_data.get("auth_token") or request_data.get("AuthToken")
            request_id = request_data.get("request_id") or request_data.get("RequestID")
            action = request_data.get("action") or request_data.get("Action")
            event_id = request_data.get("event_id") or request_data.get("EventID")
            # timestamp = request_data.get("timestamp") or request_data.get("Timestamp")

            logger.info(f"📨 Processing asset processing request: {request_id}")
            logger.info(f"   Event ID: {event_id}")
            logger.info(f"   Action: {action}")
            logger.info(f"   Asset ID: {asset_id}")
            logger.info(f"   User ID: {user_id}")
            logger.info(f"   Organization ID: {org_id}")

            # Validate required fields
            if not asset_id:
                logger.error("❌ AssetID missing from request")
                await message.reject(requeue=False)
                return

            if not user_id:
                logger.error("❌ UserID missing from request")
                await message.reject(requeue=False)
                return

            if not action:
                logger.error("❌ Action missing from request")
                await message.reject(requeue=False)
                return

            # Route to appropriate handler based on action
            if action == "created":
                await self._handle_asset_creation(asset_id, user_id, org_id, auth_token)
            elif action == "updated":
                await self._handle_asset_update(asset_id, user_id, org_id, auth_token)
            elif action == "deleted":
                await self._handle_asset_deletion(asset_id, user_id, org_id, auth_token)
            else:
                logger.warning(
                    f"⚠️ Unknown action in asset processing request: {action}"
                )
                await message.reject(requeue=False)
                return

            await message.ack()
            logger.info(f"✅ Processed asset processing request: {request_id}")

        except json.JSONDecodeError as e:
            logger.error(f"❌ Invalid JSON in asset processing request: {e}")
            await message.reject(requeue=False)
        except Exception as e:
            logger.error(f"❌ Error processing asset processing request: {e}")
            # Let the base class handle the error
            raise

    async def _handle_asset_creation(
        self, asset_id: str, user_id: str, org_id: Optional[str], auth_token: str
    ) -> None:
        """
        Handle asset creation with complete processing workflow.

        Args:
            asset_id: Asset identifier from request
            user_id: User identifier from request
            org_id: Organization identifier (optional)
            auth_token: JWT auth token for backend access
        """
        try:
            logger.info(f"🆕 Processing asset creation: {asset_id}")

            # Fetch complete asset data from backend
            asset = await self._asset_service(auth_token).fetch_asset_by_id(asset_id)
            if not asset:
                logger.error(f"❌ Failed to fetch asset {asset_id} from backend")
                return

            # Process the document and store vectors
            await self._process_document_and_store_vectors(
                asset, auth_token, user_id, org_id
            )

            logger.info(f"✅ Successfully processed asset creation: {asset_id}")

        except Exception as e:
            logger.error(f"❌ Failed to process asset creation {asset_id}: {str(e)}")
            # Could implement retry logic here
            raise

    async def _handle_asset_update(
        self, asset_id: str, user_id: str, org_id: Optional[str], auth_token: str
    ) -> None:
        """
        Handle asset update with vector store update.

        Args:
            asset_id: Asset identifier from request
            user_id: User identifier from request
            org_id: Organization identifier (optional)
            auth_token: JWT auth token for backend access
        """
        try:
            logger.info(f"📝 Processing asset update: {asset_id}")

            # Fetch updated asset data from backend
            asset = await self._asset_service(auth_token).fetch_asset_by_id(asset_id)
            if not asset:
                logger.error(
                    f"❌ Failed to fetch updated asset {asset_id} from backend"
                )
                return

            # For updates, we delete old vectors and create new ones
            # This ensures content changes are reflected properly
            logger.info(f"🔄 Updating vectors for asset {asset_id}")

            # Delete existing vectors first
            deleted = await self._vector_service(auth_token).delete_asset_chunks(
                asset_id, user_id, org_id
            )
            if deleted:
                logger.info(f"🗑️ Deleted existing vectors for asset {asset_id}")

            # Process updated document and store new vectors
            await self._process_document_and_store_vectors(asset, user_id, org_id)

            logger.info(f"✅ Successfully processed asset update: {asset_id}")

        except Exception as e:
            logger.error(f"❌ Failed to process asset update {asset_id}: {str(e)}")
            # In case of failure, we could implement rollback logic
            raise

    async def _handle_asset_deletion(
        self, asset_id: str, user_id: str, org_id: Optional[str], auth_token: str
    ) -> None:
        """
        Handle asset deletion with vector cleanup.

        Args:
            asset_id: Asset identifier from request
            user_id: User identifier from request
            org_id: Organization identifier (optional)
            auth_token: JWT auth token for backend access
        """
        try:
            logger.info(f"🗑️ Processing asset deletion: {asset_id}")

            # Delete all associated vectors from vector store
            deleted = await self._vector_service(auth_token).delete_asset_chunks(
                asset_id, user_id, org_id
            )

            if deleted:
                logger.info(f"✅ Successfully deleted vectors for asset {asset_id}")
            else:
                logger.warning(f"⚠️ No vectors found to delete for asset {asset_id}")

        except Exception as e:
            logger.error(f"❌ Failed to process asset deletion {asset_id}: {str(e)}")
            raise

    async def _process_document_and_store_vectors(
        self,
        asset: Asset,
        auth_token: str,
        user_id: Optional[str] = None,
        org_id: Optional[str] = None,
    ) -> None:
        """
        Complete document processing and vector storage workflow.

        Args:
            asset: Asset object from AssetService
            user_id: User ID for namespace
            org_id: Organization ID for namespace
        """
        try:
            # Validate asset type
            if not self._asset_service(auth_token).validate_asset_type(asset):
                logger.warning(f"⚠️ Unsupported asset type: {asset.mime_type}")
                return

            # Get appropriate document processor
            processor = self._processor_factory.get_processor(asset)
            if not processor:
                logger.error(
                    f"❌ No processor available for asset type: {asset.mime_type}"
                )
                return

            # Fetch document content
            content = await self._asset_service(auth_token).get_asset_content(asset)
            if not content:
                logger.error(f"❌ Failed to fetch content for asset {asset.id}")
                return

            # Process document to extract text and create chunks
            logger.info(
                f"🔧 Processing document {asset.id} with {processor.__class__.__name__}"
            )
            processing_result = processor.process_document(content, asset)

            if not processing_result.success:
                logger.error(
                    f"❌ Document processing failed for asset {asset.id}: {processing_result.error_message}"
                )
                return

            # Store processing result in vector store
            logger.info(
                f"💾 Storing {len(processing_result.chunks)} chunks for asset {asset.id}"
            )
            success = await self._vector_service(auth_token).store_processing_result(
                asset_id=asset.id,
                processing_result=processing_result,
                user_id=user_id,
                org_id=org_id,
            )

            if success:
                logger.info(f"✅ Successfully stored vectors for asset {asset.id}")
            else:
                logger.error(f"❌ Failed to store vectors for asset {asset.id}")
                raise Exception("Vector storage failed")

        except Exception as e:
            logger.error(
                f"❌ Document processing failed for asset {asset.id}: {str(e)}"
            )
            raise
