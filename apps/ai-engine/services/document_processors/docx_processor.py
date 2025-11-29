"""
DOCX Document Processor - Handles Microsoft Word DOCX file processing

Extracts text content from DOCX files using python-docx library and prepares
the content for vector storage operations.
"""

import logging
from models.asset import Asset
from .base_document_processor import BaseDocumentProcessor

logger = logging.getLogger(__name__)


class DOCXDocumentProcessor(BaseDocumentProcessor):
    """Document processor specifically for DOCX files"""

    def __init__(self):
        super().__init__()
        self.supported_mime_types = [
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",  # For older .doc files (limited support)
        ]
        self.max_chunk_size = 1200
        self.chunk_overlap = 250

    def validate_content(self, content: bytes, asset: Asset) -> bool:
        """
        Validate if the content is a valid DOCX file

        Args:
            content: Raw DOCX content as bytes
            asset: Asset model with metadata

        Returns:
            Boolean indicating if content is a valid DOCX
        """
        try:
            # DOCX files are ZIP archives, check for ZIP signature
            if not content.startswith(b"PK"):
                logger.warning(f"⚠️ Invalid DOCX/ZIP header for asset: {asset.id}")
                return False

            # Check minimum file size
            if len(content) < 100:  # DOCX files are typically larger
                logger.warning(f"⚠️ DOCX file too small for asset: {asset.id}")
                return False

            # Additional validation could check for specific DOCX structure
            # For now, we rely on the ZIP header and MIME type

            return True

        except Exception as e:
            logger.error(f"❌ Error validating DOCX content for {asset.id}: {e}")
            return False

    def extract_text(self, content: bytes, asset: Asset) -> str:
        """
        Extract text content from DOCX using python-docx

        Args:
            content: Raw DOCX content as bytes
            asset: Asset model with metadata

        Returns:
            Extracted text content as string

        Raises:
            Exception: If DOCX text extraction fails
        """
        try:
            import io
            from docx import Document

            logger.debug(f"📄 Extracting text from DOCX: {asset.id}")

            # Create a BytesIO object from content
            docx_stream = io.BytesIO(content)

            # Load the document
            doc = Document(docx_stream)

            # Extract text from paragraphs
            extracted_text = ""
            paragraph_count = 0

            for paragraph in doc.paragraphs:
                text = paragraph.text.strip()
                if text:  # Only add non-empty paragraphs
                    extracted_text += text + "\n\n"
                    paragraph_count += 1

            # Extract text from tables
            table_count = 0
            for table in doc.tables:
                table_count += 1
                extracted_text += f"\n--- Table {table_count} ---\n"

                for row in table.rows:
                    row_text = []
                    for cell in row.cells:
                        cell_text = cell.text.strip()
                        if cell_text:
                            row_text.append(cell_text)

                    if row_text:
                        extracted_text += " | ".join(row_text) + "\n"

                extracted_text += "\n"

            # Clean up the extracted text
            extracted_text = self._clean_extracted_text(extracted_text)

            if not extracted_text.strip():
                raise Exception("No text content found in DOCX document")

            logger.debug(
                f"✅ Extracted {len(extracted_text)} characters from DOCX: {asset.id}"
            )
            logger.debug(
                f"📊 Found {paragraph_count} paragraphs and {table_count} tables"
            )

            return extracted_text

        except ImportError:
            error_msg = "python-docx library not installed. Install with: pip install python-docx"
            logger.error(f"❌ {error_msg}")
            raise Exception(error_msg)

        except Exception as e:
            logger.error(f"❌ Error extracting text from DOCX {asset.id}: {e}")
            raise Exception(f"DOCX text extraction failed: {str(e)}")

    def _clean_extracted_text(self, text: str) -> str:
        """
        Clean and normalize extracted DOCX text

        Args:
            text: Raw extracted text

        Returns:
            Cleaned text content
        """
        if not text:
            return ""

        # Normalize line endings and remove excessive whitespace
        lines = []
        for line in text.split("\n"):
            line = line.strip()
            lines.append(line)  # Keep empty lines for paragraph separation

        # Join lines and remove excessive empty lines (more than 2 consecutive)
        text = "\n".join(lines)
        import re

        text = re.sub(r"\n{3,}", "\n\n", text)

        # Remove excessive spaces within lines
        text = re.sub(r" +", " ", text)

        return text.strip()

    def _extract_document_properties(self, doc) -> dict:
        """
        Extract document properties/metadata from DOCX

        Args:
            doc: python-docx Document object

        Returns:
            Dictionary containing document properties
        """
        properties = {}

        try:
            core_props = doc.core_properties

            # Extract available properties
            if hasattr(core_props, "title") and core_props.title:
                properties["doc_title"] = core_props.title

            if hasattr(core_props, "author") and core_props.author:
                properties["doc_author"] = core_props.author

            if hasattr(core_props, "subject") and core_props.subject:
                properties["doc_subject"] = core_props.subject

            if hasattr(core_props, "created") and core_props.created:
                properties["doc_created"] = core_props.created.isoformat()

            if hasattr(core_props, "modified") and core_props.modified:
                properties["doc_modified"] = core_props.modified.isoformat()

        except Exception as e:
            logger.debug(f"Could not extract document properties: {e}")

        return properties

    def generate_metadata(self, asset: Asset, extracted_text: str) -> dict:
        """
        Generate DOCX-specific metadata

        Args:
            asset: Asset model with metadata
            extracted_text: Extracted text content

        Returns:
            Dictionary containing DOCX-specific metadata
        """
        metadata = super().generate_metadata(asset, extracted_text)

        # Add DOCX-specific metadata
        metadata.update(
            {
                "document_type": "docx",
                "extraction_method": "python-docx",
                "estimated_paragraphs": extracted_text.count("\n\n") + 1,
                "has_tables": "--- Table" in extracted_text,
                "table_count": extracted_text.count("--- Table")
                if "--- Table" in extracted_text
                else 0,
            }
        )

        return metadata
