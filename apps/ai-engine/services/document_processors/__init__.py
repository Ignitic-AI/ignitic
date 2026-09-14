"""
Document Processors Package

Provides modular document processing capabilities for different file types.
Each processor handles specific document formats and extracts text content
for vector storage operations.

Available Processors:
- PDFDocumentProcessor: For PDF files
- TextDocumentProcessor: For text-based files (txt, md, html, csv, json)
- DOCXDocumentProcessor: For Microsoft Word DOCX files

Usage:
    from services.document_processors import ProcessorFactory

    processor = ProcessorFactory.get_processor(asset)
    result = processor.process_document(content, asset)
"""

import logging
from typing import Dict, Optional, List
from models.asset import Asset
from .base_document_processor import (
    BaseDocumentProcessor,
    AssetProcessingResult,
    DocumentChunk,
)
from .pdf_processor import PDFDocumentProcessor
from .text_processor import TextDocumentProcessor
from .docx_processor import DOCXDocumentProcessor

from loguru import logger


class ProcessorFactory:
    """Factory class for creating appropriate document processors"""

    _processors: Dict[str, BaseDocumentProcessor] = {}
    _initialized = False

    @classmethod
    def _initialize_processors(cls):
        """Initialize all available processors"""
        if cls._initialized:
            return

        try:
            # Initialize all processors
            processors = [
                PDFDocumentProcessor(),
                TextDocumentProcessor(),
                DOCXDocumentProcessor(),
            ]

            # Map MIME types to processors
            for processor in processors:
                for mime_type in processor.get_supported_types():
                    cls._processors[mime_type] = processor

            cls._initialized = True
            logger.info(f"✅ Initialized {len(processors)} document processors")
            logger.debug(f"📋 Supported MIME types: {list(cls._processors.keys())}")

        except Exception as e:
            logger.error(f"❌ Error initializing document processors: {e}")
            raise

    @classmethod
    def get_processor(cls, asset: Asset) -> Optional[BaseDocumentProcessor]:
        """
        Get appropriate processor for the given asset

        Args:
            asset: Asset model to get processor for

        Returns:
            Appropriate document processor or None if unsupported
        """
        cls._initialize_processors()

        processor = cls._processors.get(asset.mime_type)

        if processor:
            logger.debug(
                f"📄 Found processor {processor.__class__.__name__} for {asset.mime_type}"
            )
        else:
            logger.warning(f"⚠️ No processor found for MIME type: {asset.mime_type}")

        return processor

    @classmethod
    def is_supported(cls, asset: Asset) -> bool:
        """
        Check if the asset type is supported

        Args:
            asset: Asset model to check

        Returns:
            Boolean indicating if asset type is supported
        """
        cls._initialize_processors()
        return asset.mime_type in cls._processors

    @classmethod
    def get_supported_mime_types(cls) -> List[str]:
        """
        Get list of all supported MIME types

        Returns:
            List of supported MIME types
        """
        cls._initialize_processors()
        return list(cls._processors.keys())

    @classmethod
    def get_processor_info(cls) -> Dict[str, List[str]]:
        """
        Get information about all processors and their supported types

        Returns:
            Dictionary mapping processor names to supported MIME types
        """
        cls._initialize_processors()

        info = {}
        processed_processors = set()

        for mime_type, processor in cls._processors.items():
            processor_name = processor.__class__.__name__

            if processor_name not in processed_processors:
                info[processor_name] = processor.get_supported_types()
                processed_processors.add(processor_name)

        return info


# Convenience function for direct processing
async def process_asset_document(
    content: bytes, asset: Asset
) -> Optional[AssetProcessingResult]:
    """
    Convenience function to process a document asset

    Args:
        content: Raw document content as bytes
        asset: Asset model with metadata

    Returns:
        ProcessingResult if successful, None if no processor available
    """
    try:
        processor = ProcessorFactory.get_processor(asset)

        if not processor:
            logger.warning(
                f"⚠️ No processor available for asset {asset.id} ({asset.mime_type})"
            )
            return None

        result = processor.process_document(content, asset)

        if result.success:
            logger.info(
                f"✅ Successfully processed asset {asset.id} with {len(result.chunks)} chunks"
            )
        else:
            logger.error(
                f"❌ Failed to process asset {asset.id}: {result.error_message}"
            )

        return result

    except Exception as e:
        logger.error(f"❌ Error processing asset document {asset.id}: {e}")
        return AssetProcessingResult(
            chunks=[],
            metadata={},
            success=False,
            error_message=f"Processing error: {str(e)}",
        )


# Export key classes and functions
__all__ = [
    "BaseDocumentProcessor",
    "DocumentChunk",
    "AssetProcessingResult",
    "PDFDocumentProcessor",
    "TextDocumentProcessor",
    "DOCXDocumentProcessor",
    "ProcessorFactory",
    "process_asset_document",
]
