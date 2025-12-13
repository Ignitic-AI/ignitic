"""
Base Document Processor - Abstract base class for all document processors

Provides a consistent interface for processing different document types,
extracting text content, and preparing data for vector storage operations.
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime
from models.asset import Asset

from loguru import logger


class DocumentChunk:
    """Represents a chunk of processed document content"""

    def __init__(
        self,
        content: str,
        metadata: Dict[str, Any],
        chunk_index: int = 0,
        start_char: Optional[int] = None,
        end_char: Optional[int] = None,
    ):
        self.content = content
        self.metadata = metadata
        self.chunk_index = chunk_index
        self.start_char = start_char
        self.end_char = end_char
        self.created_at = datetime.now()


class ProcessingResult:
    """Result of document processing operation"""

    def __init__(
        self,
        chunks: List[DocumentChunk],
        metadata: Dict[str, Any],
        success: bool = True,
        error_message: Optional[str] = None,
    ):
        self.chunks = chunks
        self.metadata = metadata
        self.success = success
        self.error_message = error_message
        self.processed_at = datetime.now()


class BaseDocumentProcessor(ABC):
    """Abstract base class for all document processors"""

    def __init__(self):
        self.processor_name = self.__class__.__name__
        self.supported_mime_types: List[str] = []
        self.max_chunk_size = 1000  # Default chunk size
        self.chunk_overlap = 200  # Default overlap between chunks

    @abstractmethod
    def extract_text(self, content: bytes, asset: Asset) -> str:
        """
        Extract raw text content from document bytes

        Args:
            content: Raw document content as bytes
            asset: Asset model with metadata

        Returns:
            Extracted text content as string

        Raises:
            Exception: If text extraction fails
        """
        pass

    @abstractmethod
    def validate_content(self, content: bytes, asset: Asset) -> bool:
        """
        Validate if the content can be processed by this processor

        Args:
            content: Raw document content as bytes
            asset: Asset model with metadata

        Returns:
            Boolean indicating if content is valid for this processor
        """
        pass

    def generate_metadata(self, asset: Asset, extracted_text: str) -> Dict[str, Any]:
        """
        Generate metadata for the processed document

        Args:
            asset: Asset model with metadata
            extracted_text: Extracted text content

        Returns:
            Dictionary containing document metadata
        """
        return {
            "asset_id": asset.id,
            "title": asset.title,
            "mime_type": asset.mime_type,
            "file_extension": asset.file_ext,
            "size_bytes": asset.size_bytes,
            "user_id": asset.user_id,
            "organization_id": asset.organization_id,
            "category": asset.category,
            "storage_provider": asset.storage_provider,
            "text_length": len(extracted_text),
            "processor_name": self.processor_name,
            "created_at": asset.created_at.isoformat(),
            "updated_at": asset.updated_at.isoformat(),
            "processed_at": datetime.now().isoformat(),
        }

    def chunk_text(self, text: str, metadata: Dict[str, Any]) -> List[DocumentChunk]:
        """
        Split text into manageable chunks for vector processing

        Args:
            text: Extracted text content
            metadata: Document metadata

        Returns:
            List of DocumentChunk objects
        """
        if not text or not text.strip():
            return []

        chunks = []
        text_length = len(text)

        # If text is smaller than chunk size, return as single chunk
        if text_length <= self.max_chunk_size:
            chunk = DocumentChunk(
                content=text.strip(),
                metadata=metadata.copy(),
                chunk_index=0,
                start_char=0,
                end_char=text_length,
            )
            return [chunk]

        # Split into overlapping chunks
        chunk_index = 0
        start = 0

        while start < text_length:
            # Calculate end position
            end = min(start + self.max_chunk_size, text_length)

            # Adjust end to avoid cutting words (find last space)
            if end < text_length:
                last_space = text.rfind(" ", start, end)
                if last_space > start:
                    end = last_space

            chunk_text = text[start:end].strip()

            if chunk_text:  # Only add non-empty chunks
                chunk_metadata = metadata.copy()
                chunk_metadata.update(
                    {
                        "chunk_index": chunk_index,
                        "chunk_start": start,
                        "chunk_end": end,
                        "total_chunks": None,  # Will be set after all chunks are created
                    }
                )

                chunk = DocumentChunk(
                    content=chunk_text,
                    metadata=chunk_metadata,
                    chunk_index=chunk_index,
                    start_char=start,
                    end_char=end,
                )
                chunks.append(chunk)
                chunk_index += 1

            # Move start position with overlap
            start = max(end - self.chunk_overlap, start + 1)

            # Prevent infinite loop
            if start >= text_length:
                break

        # Update total_chunks in all chunk metadata
        total_chunks = len(chunks)
        for chunk in chunks:
            chunk.metadata["total_chunks"] = total_chunks

        return chunks

    def process_document(self, content: bytes, asset: Asset) -> ProcessingResult:
        """
        Main processing method that orchestrates the entire document processing workflow

        Args:
            content: Raw document content as bytes
            asset: Asset model with metadata

        Returns:
            ProcessingResult with chunks and metadata
        """
        try:
            logger.info(
                f"🔄 Processing document with {self.processor_name}: {asset.id}"
            )

            # Validate content first
            if not self.validate_content(content, asset):
                return ProcessingResult(
                    chunks=[],
                    metadata={},
                    success=False,
                    error_message=f"Content validation failed for {self.processor_name}",
                )

            # Extract text content
            extracted_text = self.extract_text(content, asset)

            if not extracted_text or not extracted_text.strip():
                return ProcessingResult(
                    chunks=[],
                    metadata={},
                    success=False,
                    error_message="No text content extracted from document",
                )

            # Generate metadata
            metadata = self.generate_metadata(asset, extracted_text)

            # Create chunks
            chunks = self.chunk_text(extracted_text, metadata)

            if not chunks:
                return ProcessingResult(
                    chunks=[],
                    metadata=metadata,
                    success=False,
                    error_message="No valid chunks created from extracted text",
                )

            logger.info(
                f"✅ Successfully processed document: {asset.id} ({len(chunks)} chunks)"
            )

            return ProcessingResult(chunks=chunks, metadata=metadata, success=True)

        except Exception as e:
            logger.error(
                f"❌ Error processing document {asset.id} with {self.processor_name}: {e}"
            )
            return ProcessingResult(
                chunks=[],
                metadata={},
                success=False,
                error_message=f"Processing failed: {str(e)}",
            )

    def can_process(self, asset: Asset) -> bool:
        """
        Check if this processor can handle the given asset type

        Args:
            asset: Asset model to check

        Returns:
            Boolean indicating if this processor supports the asset's MIME type
        """
        return asset.mime_type in self.supported_mime_types

    def get_supported_types(self) -> List[str]:
        """
        Get list of MIME types supported by this processor

        Returns:
            List of supported MIME types
        """
        return self.supported_mime_types.copy()
