from typing import List, Dict
import cloudinary
from fastapi import HTTPException
from core.backend_client import BackendClient
from core.auth import AuthProvider
from models.asset import Asset
from dotenv import load_dotenv
from loguru import logger

load_dotenv()

config = cloudinary.config(secure=True)

class AssetService:
    """Service for managing asset data from backend and preparing for vector processing"""

    # Supported asset types for processing
    SUPPORTED_ASSET_TYPES = {
        "application/pdf": [".pdf"],
        "text/plain": [".txt"],
        "text/markdown": [".md"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
            ".docx"
        ],
        "application/msword": [".doc"],
        "text/html": [".html", ".htm"],
        "text/csv": [".csv"],
        "application/json": [".json"],
    }

    def __init__(self, auth: AuthProvider):
        """
        Initialize AssetService with authentication provider

        Args:
            auth: AuthProvider instance for backend communication
        """
        self._auth = auth
        self._backend_client = BackendClient(auth)

    async def fetch_asset_by_id(self, asset_id: str) -> Asset:
        """
        Fetch asset metadata and basic information by ID

        Args:
            asset_id: Unique identifier for the asset

        Returns:
            Asset model containing asset metadata

        Raises:
            HTTPException: If asset not found or access denied
        """
        try:
            logger.info(f"🔍 Fetching asset metadata for ID: {asset_id}")

            asset_data = await self._backend_client.get(f"assets/{asset_id}")

            if not asset_data:
                raise HTTPException(
                    status_code=404, detail=f"Asset not found: {asset_id}"
                )

            # Parse the response into Asset model
            asset = Asset(**asset_data)
            logger.info(f"✅ Successfully fetched asset: {asset_id}")
            return asset

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error fetching asset {asset_id}: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to fetch asset: {str(e)}"
            )

    async def get_asset_content(self, asset: Asset) -> bytes:
        """
        Fetch the actual content/file data for an asset

        Args:
            asset: Asset model instance

        Returns:
            Raw bytes content of the asset

        Raises:
            HTTPException: If content not found or download failed
        """
        import httpx

        try:
            logger.info(f"📥 Downloading content for asset: {asset.id}")

            if not asset.url:
                raise HTTPException(
                    status_code=404,
                    detail=f"Asset {asset.id} does not have a valid URL",
                )
            
            cloudinary_path = f"{asset.path}"

            logger.info(f"🌐 Signing **private** url for path: {cloudinary_path} ")
            public_asset_url = cloudinary.CloudinaryImage(cloudinary_path).build_url(
                type="private",  # <--- THIS MUST BE "private"
                sign_url=True,
                format=asset.file_ext
            )

            logger.info(f"🔗 Private (Signed) URL obtained: {public_asset_url}")

            # Download content directly from the asset URL
            async with httpx.AsyncClient() as client:
                response = await client.get(public_asset_url)
                response.raise_for_status()
                content_bytes = response.content

            logger.info(
                f"✅ Successfully downloaded content for asset: {asset.id} ({len(content_bytes)} bytes)"
            )
            return content_bytes

        except HTTPException:
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"❌ HTTP error downloading asset {asset.id}: {e}")
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Failed to download asset content: {str(e)}",
            )
        except Exception as e:
            logger.error(f"❌ Error downloading content for asset {asset.id}: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to download asset content: {str(e)}"
            )

    async def get_asset_with_content(self, asset_id: str) -> tuple[Asset, bytes]:
        """
        Fetch both asset metadata and content in one call

        Args:
            asset_id: Unique identifier for the asset

        Returns:
            Tuple of (Asset model, content bytes)

        Raises:
            HTTPException: If asset not found or content download failed
        """
        try:
            logger.info(f"🔄 Fetching asset metadata and content for: {asset_id}")

            # Fetch asset metadata first
            asset = await self.fetch_asset_by_id(asset_id)

            # Fetch asset content
            content_bytes = await self.get_asset_content(asset)

            logger.info(
                f"✅ Successfully fetched asset and content: {asset_id} ({len(content_bytes)} bytes)"
            )
            return asset, content_bytes

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error fetching asset with content {asset_id}: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to fetch asset with content: {str(e)}"
            )

    def validate_asset_type(self, asset: Asset) -> bool:
        """
        Validate if asset type is supported for processing

        Args:
            asset: Asset model instance

        Returns:
            Boolean indicating if asset type is supported
        """
        try:
            mime_type = asset.mime_type

            if not mime_type:
                logger.warning(f"⚠️ Could not determine MIME type for asset: {asset.id}")
                return False

            is_supported = mime_type in self.SUPPORTED_ASSET_TYPES

            if not is_supported:
                logger.info(
                    f"📋 Unsupported asset type: {mime_type} for asset: {asset.id}"
                )
            else:
                logger.info(
                    f"✅ Asset type supported: {mime_type} for asset: {asset.id}"
                )

            return is_supported

        except Exception as e:
            logger.error(f"❌ Error validating asset type: {e}")
            return False

    async def handle_asset_deletion(self, asset_id: str) -> bool:
        """
        Handle asset deletion cleanup operations

        Args:
            asset_id: ID of asset being deleted

        Returns:
            Boolean indicating success
        """
        try:
            logger.info(f"🗑️ Handling deletion for asset: {asset_id}")

            # Verify asset exists and user has access
            try:
                await self.fetch_asset_by_id(asset_id)
            except HTTPException as e:
                if e.status_code == 404:
                    logger.info(f"ℹ️ Asset {asset_id} already deleted or not found")
                    return True
                raise

            # Additional cleanup operations can be added here
            # For now, we just log the deletion
            logger.info(f"✅ Asset deletion handled: {asset_id}")
            return True

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error handling asset deletion {asset_id}: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to handle asset deletion: {str(e)}"
            )

    def get_supported_asset_types(self) -> Dict[str, List[str]]:
        """
        Get list of supported asset types and their file extensions

        Returns:
            Dictionary mapping MIME types to file extensions
        """
        return self.SUPPORTED_ASSET_TYPES.copy()

    async def get_user_assets(self) -> List[Asset]:
        """
        Get list of assets for the current authenticated user

        Returns:
            List of Asset model instances for the authenticated user
        """
        try:
            current_user = self._auth.get_user()
            logger.info(f"📋 Fetching assets for authenticated user: {current_user.id}")

            # Use backend API to get user's assets - auth is handled automatically by backend
            assets_data = await self._backend_client.get("/api/v1/assets")

            if not isinstance(assets_data, list):
                assets_data = (
                    assets_data.get("assets", [])
                    if isinstance(assets_data, dict)
                    else []
                )

            # Convert to Asset models
            assets = [Asset(**asset_data) for asset_data in assets_data]

            logger.info(f"✅ Found {len(assets)} assets for authenticated user")
            return assets

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error fetching assets for authenticated user: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to fetch user assets: {str(e)}"
            )
