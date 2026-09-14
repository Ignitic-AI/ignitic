"""
Asset models for representing asset data from backend API

Defines Pydantic models for asset data and processing status structures
used in the asset notification and vector processing system.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from beanie import Document


class Asset(BaseModel):
    """Pydantic model representing an asset from the backend API"""

    id: str = Field(..., description="Unique identifier for the asset")
    user_id: str = Field(..., description="ID of the user who owns the asset")
    organization_id: Optional[str] = Field(
        None, description="ID of the organization that owns the asset"
    )
    category: str = Field(
        ..., description="Category of the asset (e.g., business_profile)"
    )
    title: str = Field(..., description="Human-readable title of the asset")
    storage_provider: str = Field(
        ..., description="Storage provider (e.g., cloudinary)"
    )
    path: str = Field(..., description="Storage path of the asset")
    url: str = Field(..., description="Direct URL to access the asset")
    mime_type: str = Field(..., description="MIME type of the asset")
    file_ext: str = Field(..., description="File extension without the dot")
    size_bytes: int = Field(..., description="Size of the asset in bytes")
    created_by: str = Field(..., description="ID of the user who created the asset")
    created_at: datetime = Field(..., description="Timestamp when asset was created")
    updated_at: datetime = Field(
        ..., description="Timestamp when asset was last updated"
    )

    class Config:
        """Pydantic configuration"""

        json_encoders = {datetime: lambda v: v.isoformat()}


class ProcessingStatus(BaseModel):
    """Asset processing status for tracking vector operations"""

    asset_id: str
    status: str  # 'pending', 'processing', 'completed', 'failed'
    message: Optional[str] = None
    processed_at: Optional[datetime] = None
    vector_store_ids: list[str] = Field(default_factory=list)
    error_details: Optional[str] = None


class AssetProcessingDocument(Document):
    """MongoDB document for tracking asset processing status"""

    asset_id: str
    user_id: str
    org_id: Optional[str] = None
    status: str = "pending"  # 'pending', 'processing', 'completed', 'failed'
    message: Optional[str] = None
    processed_at: Optional[datetime] = None
    vector_store_ids: list[str] = Field(default_factory=list)
    error_details: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "asset_processing"
        indexes = [
            "asset_id",
            "user_id",
            "status",
            [("user_id", 1), ("status", 1)],
            [("asset_id", 1), ("user_id", 1)],
        ]
