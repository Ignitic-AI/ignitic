"""
Asset notification API routes

Provides endpoints for manual asset processing, status checking, and administrative
operations for the asset notification service that manages vector stores in MongoDB.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from core.auth import get_auth, AuthProvider
from services.asset_service import AssetService
from services.mongo_vector_store_service import MongoVectorStoreService
from services.document_processors import ProcessorFactory, DocumentChunk
from models.asset import AssetProcessingDocument
import logging
from datetime import datetime

router = APIRouter(prefix="/assets")
logger = logging.getLogger(__name__)


# Request/Response models
class ProcessAssetRequest(BaseModel):
    """Request model for manual asset processing"""

    asset_id: str = Field(..., description="Asset ID to process")
    force_reprocess: bool = Field(
        default=False, description="Force reprocessing even if already processed"
    )


class ProcessAssetResponse(BaseModel):
    """Response model for asset processing"""

    success: bool
    message: str
    asset_id: str
    processing_id: Optional[str] = None


class AssetStatusResponse(BaseModel):
    """Response model for asset processing status"""

    asset_id: str
    status: str
    message: Optional[str] = None
    processed_at: Optional[datetime] = None
    vector_count: int
    error_details: Optional[str] = None


class VectorSearchRequest(BaseModel):
    """Request model for vector search"""

    query: str = Field(..., description="Search query text")
    limit: int = Field(default=10, description="Maximum number of results")
    asset_ids: Optional[List[str]] = Field(
        None, description="Filter by specific asset IDs"
    )


class VectorSearchResponse(BaseModel):
    """Response model for vector search results"""

    results: List[DocumentChunk]
    total_count: int
    query: str


@router.post("/process", response_model=ProcessAssetResponse)
async def process_asset(
    request: ProcessAssetRequest, auth: AuthProvider = Depends(get_auth)
):
    """
    Manually trigger processing for a specific asset.

    This endpoint allows for manual asset processing, useful for:
    - Reprocessing assets after system updates
    - Processing assets that failed initial processing
    - Admin operations for asset management

    Args:
        request: Asset processing request with asset_id and options
        auth: Authentication provider for user context

    Returns:
        ProcessAssetResponse: Processing result with status and details

    Raises:
        HTTPException: 400 for validation errors, 404 for missing assets, 500 for processing errors
    """
    try:
        user = auth.get_user()
        logger.info(
            f"🔧 Manual asset processing requested by user {user.id} for asset {request.asset_id}"
        )

        # Initialize services
        asset_service = AssetService(auth)
        vector_service = MongoVectorStoreService(auth)
        processor_factory = ProcessorFactory()

        # Validate asset exists and user has access
        try:
            asset = await asset_service.fetch_asset_by_id(request.asset_id)
        except Exception as e:
            logger.error(f"❌ Asset {request.asset_id} not found or access denied: {e}")
            raise HTTPException(
                status_code=404, detail=f"Asset not found or access denied: {str(e)}"
            )

        # Check if already processed (unless force reprocess)
        if not request.force_reprocess:
            existing_chunks = await vector_service.search_asset_chunks(
                query="",
                asset_ids=[request.asset_id],
                user_id=user.id,
                org_id=user.org_id,
                limit=1,
            )
            if existing_chunks:
                logger.info(
                    f"⚠️ Asset {request.asset_id} already processed, skipping (use force_reprocess=true to override)"
                )
                return ProcessAssetResponse(
                    success=True,
                    message="Asset already processed",
                    asset_id=request.asset_id,
                )

        # Create processing document for tracking
        processing_doc = AssetProcessingDocument(
            asset_id=request.asset_id,
            user_id=user.id,
            org_id=user.org_id,
            status="processing",
            message="Manual processing initiated",
        )
        await processing_doc.save()

        # Process the asset
        try:
            # Fetch asset content
            content_stream = await asset_service.get_asset_content(request.asset_id)

            # Get appropriate processor
            processor = processor_factory.get_processor(asset)
            if not processor:
                raise ValueError(
                    f"No processor available for MIME type: {asset.mime_type}"
                )

            # Process document
            processing_result = processor.process_document(content_stream, asset)

            # Store in vector store
            await vector_service.store_processing_result(
                request.asset_id, processing_result, user.id, user.org_id
            )

            # Update processing status
            processing_doc.status = "completed"
            processing_doc.message = (
                f"Successfully processed {len(processing_result.chunks)} chunks"
            )
            processing_doc.processed_at = datetime.now()
            processing_doc.vector_store_ids = [
                f"chunk_{i}" for i in range(len(processing_result.chunks))
            ]
            await processing_doc.save()

            logger.info(
                f"✅ Successfully processed asset {request.asset_id} with {len(processing_result.chunks)} chunks"
            )

            return ProcessAssetResponse(
                success=True,
                message=f"Asset processed successfully with {len(processing_result.chunks)} chunks",
                asset_id=request.asset_id,
                processing_id=str(processing_doc.id),
            )

        except Exception as e:
            # Update processing status on failure
            processing_doc.status = "failed"
            processing_doc.message = "Processing failed"
            processing_doc.error_details = str(e)
            await processing_doc.save()
            raise

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error processing asset {request.asset_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Internal processing error: {str(e)}"
        )


@router.get("/{asset_id}/status", response_model=AssetStatusResponse)
async def get_asset_status(asset_id: str, auth: AuthProvider = Depends(get_auth)):
    """
    Get processing status for a specific asset.

    Returns the current processing status, vector count, and any error details
    for the specified asset.

    Args:
        asset_id: Asset ID to check status for
        auth: Authentication provider for user context

    Returns:
        AssetStatusResponse: Current status and processing details

    Raises:
        HTTPException: 404 if asset not found, 500 for other errors
    """
    try:
        user = auth.get_user()
        logger.info(f"📊 Status check requested for asset {asset_id} by user {user.id}")

        vector_service = MongoVectorStoreService(auth)

        # Check processing document
        processing_doc = await AssetProcessingDocument.find_one(
            {"asset_id": asset_id, "user_id": user.id}
        )

        # Get vector count
        vector_chunks = await vector_service.search_asset_chunks(
            query="",
            asset_ids=[asset_id],
            user_id=user.id,
            org_id=user.org_id,
            limit=1000,
        )
        vector_count = len(vector_chunks)

        if processing_doc:
            return AssetStatusResponse(
                asset_id=asset_id,
                status=processing_doc.status,
                message=processing_doc.message,
                processed_at=processing_doc.processed_at,
                vector_count=vector_count,
                error_details=processing_doc.error_details,
            )
        else:
            # No processing record but check if vectors exist
            status = "completed" if vector_count > 0 else "not_processed"
            return AssetStatusResponse(
                asset_id=asset_id,
                status=status,
                message=f"Found {vector_count} vector chunks"
                if vector_count > 0
                else "Asset not processed",
                processed_at=None,
                vector_count=vector_count,
                error_details=None,
            )

    except Exception as e:
        logger.error(f"❌ Error checking status for asset {asset_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error checking asset status: {str(e)}"
        )


@router.delete("/{asset_id}/vectors")
async def delete_asset_vectors(asset_id: str, auth: AuthProvider = Depends(get_auth)):
    """
    Delete all vector embeddings for a specific asset.

    This endpoint provides cleanup functionality for removing all vector
    embeddings associated with an asset from the vector store.

    Args:
        asset_id: Asset ID to delete vectors for
        auth: Authentication provider for user context

    Returns:
        dict: Deletion result with count of deleted vectors

    Raises:
        HTTPException: 500 for deletion errors
    """
    try:
        user = auth.get_user()
        logger.info(
            f"🗑️ Vector deletion requested for asset {asset_id} by user {user.id}"
        )

        vector_service = MongoVectorStoreService(auth)

        # Delete vectors
        deleted = await vector_service.delete_asset_chunks(
            asset_id, user.id, user.org_id
        )

        # Update processing status if exists
        processing_doc = await AssetProcessingDocument.find_one(
            {"asset_id": asset_id, "user_id": user.id}
        )

        if processing_doc:
            processing_doc.status = "deleted"
            processing_doc.message = "Vectors deleted manually"
            processing_doc.vector_store_ids = []
            processing_doc.updated_at = datetime.now()
            await processing_doc.save()

        logger.info(f"✅ Deleted vectors for asset {asset_id}, count: {deleted}")

        return {
            "success": True,
            "message": f"Successfully deleted {deleted} vector chunks",
            "asset_id": asset_id,
            "deleted_count": deleted,
        }

    except Exception as e:
        logger.error(f"❌ Error deleting vectors for asset {asset_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error deleting asset vectors: {str(e)}"
        )


@router.post("/search", response_model=VectorSearchResponse)
async def search_asset_vectors(
    request: VectorSearchRequest, auth: AuthProvider = Depends(get_auth)
):
    """
    Search asset vectors using semantic similarity.

    Performs vector similarity search across user's asset embeddings,
    optionally filtered by specific asset IDs.

    Args:
        request: Search request with query text and filters
        auth: Authentication provider for user context

    Returns:
        VectorSearchResponse: Search results with matching document chunks

    Raises:
        HTTPException: 400 for invalid queries, 500 for search errors
    """
    try:
        user = auth.get_user()
        logger.info(f"🔍 Vector search requested by user {user.id}: '{request.query}'")

        if not request.query.strip():
            raise HTTPException(status_code=400, detail="Search query cannot be empty")

        vector_service = MongoVectorStoreService(auth)

        # Perform search
        results = await vector_service.search_asset_chunks(
            query=request.query,
            user_id=user.id,
            org_id=user.org_id,
            limit=request.limit,
            asset_ids=request.asset_ids,
        )

        logger.info(f"✅ Found {len(results)} results for query: '{request.query}'")

        return VectorSearchResponse(
            results=results, total_count=len(results), query=request.query
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error searching vectors: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error performing vector search: {str(e)}"
        )


@router.get("/")
async def list_processed_assets(
    limit: int = Query(default=100, description="Maximum number of assets to return"),
    status: Optional[str] = Query(
        default=None, description="Filter by processing status"
    ),
    auth: AuthProvider = Depends(get_auth),
):
    """
    List processed assets for the authenticated user.

    Returns a list of assets that have been processed through the asset
    notification system, with their current processing status.

    Args:
        limit: Maximum number of assets to return
        status: Optional status filter (pending, processing, completed, failed)
        auth: Authentication provider for user context

    Returns:
        dict: List of processed assets with status information

    Raises:
        HTTPException: 500 for query errors
    """
    try:
        user = auth.get_user()
        logger.info(
            f"📋 Asset list requested by user {user.id}, limit: {limit}, status: {status}"
        )

        # Build query
        query_filter = {"user_id": user.id}
        if status:
            query_filter["status"] = status

        # Get processing documents
        processing_docs = (
            await AssetProcessingDocument.find(query_filter, limit=limit)
            .sort("-updated_at")
            .to_list()
        )

        # Format response
        assets = []
        for doc in processing_docs:
            assets.append(
                {
                    "asset_id": doc.asset_id,
                    "status": doc.status,
                    "message": doc.message,
                    "processed_at": doc.processed_at,
                    "vector_count": len(doc.vector_store_ids),
                    "created_at": doc.created_at,
                    "updated_at": doc.updated_at,
                    "error_details": doc.error_details,
                }
            )

        logger.info(f"✅ Retrieved {len(assets)} assets for user {user.id}")

        return {
            "assets": assets,
            "total_count": len(assets),
            "user_id": user.id,
            "status_filter": status,
        }

    except Exception as e:
        logger.error(f"❌ Error listing assets: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error listing processed assets: {str(e)}"
        )
