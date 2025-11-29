"""
PDF Document Processor - Handles PDF file processing

Extracts text content from PDF files using PyPDF2 library and prepares
the content for vector storage operations.
"""

import logging
from models.asset import Asset
from .base_document_processor import BaseDocumentProcessor

logger = logging.getLogger(__name__)


class PDFDocumentProcessor(BaseDocumentProcessor):
    """Document processor specifically for PDF files"""

    def __init__(self):
        super().__init__()
        self.supported_mime_types = ["application/pdf"]
        self.max_chunk_size = 1500  # Larger chunks for PDFs
        self.chunk_overlap = 300

    def validate_content(self, content: bytes, asset: Asset) -> bool:
        """
        Validate if the content is a valid PDF file

        Args:
            content: Raw PDF content as bytes
            asset: Asset model with metadata

        Returns:
            Boolean indicating if content is a valid PDF
        """
        try:
            # Check PDF header
            if not content.startswith(b"%PDF"):
                logger.warning(f"⚠️ Invalid PDF header for asset: {asset.id}")
                return False

            # Check minimum file size (PDF files are usually larger than 100 bytes)
            if len(content) < 100:
                logger.warning(f"⚠️ PDF file too small for asset: {asset.id}")
                return False

            return True

        except Exception as e:
            logger.error(f"❌ Error validating PDF content for {asset.id}: {e}")
            return False

    def extract_text(self, content: bytes, asset: Asset) -> str:
        """
        Extract text content from PDF using PyPDF2

        Args:
            content: Raw PDF content as bytes
            asset: Asset model with metadata

        Returns:
            Extracted text content as string

        Raises:
            Exception: If PDF text extraction fails
        """
        try:
            import PyPDF2
            import io

            logger.debug(f"📄 Extracting text from PDF: {asset.id}")

            # Create a BytesIO object from content
            pdf_stream = io.BytesIO(content)

            # Create PDF reader
            pdf_reader = PyPDF2.PdfReader(pdf_stream)

            # Check if PDF is encrypted
            if pdf_reader.is_encrypted:
                logger.warning(
                    f"🔒 PDF is encrypted, attempting to decrypt: {asset.id}"
                )
                # Try to decrypt with empty password
                try:
                    pdf_reader.decrypt("")
                except Exception as decrypt_error:
                    raise Exception(f"Cannot decrypt PDF: {decrypt_error}")

            # Extract text from all pages
            extracted_text = ""
            total_pages = len(pdf_reader.pages)

            logger.debug(f"📄 PDF has {total_pages} pages: {asset.id}")

            for page_num, page in enumerate(pdf_reader.pages):
                try:
                    page_text = page.extract_text()
                    if page_text:
                        extracted_text += f"\n--- Page {page_num + 1} ---\n"
                        extracted_text += page_text
                        extracted_text += "\n"

                except Exception as page_error:
                    logger.warning(
                        f"⚠️ Error extracting text from page {page_num + 1}: {page_error}"
                    )
                    continue

            # Clean up the extracted text
            extracted_text = self._clean_extracted_text(extracted_text)

            if not extracted_text.strip():
                raise Exception("No text content found in PDF")

            logger.debug(
                f"✅ Extracted {len(extracted_text)} characters from PDF: {asset.id}"
            )
            return extracted_text

        except ImportError:
            error_msg = "PyPDF2 library not installed. Install with: pip install PyPDF2"
            logger.error(f"❌ {error_msg}")
            raise Exception(error_msg)

        except Exception as e:
            logger.error(f"❌ Error extracting text from PDF {asset.id}: {e}")
            raise Exception(f"PDF text extraction failed: {str(e)}")

    def _clean_extracted_text(self, text: str) -> str:
        """
        Clean and normalize extracted PDF text

        Args:
            text: Raw extracted text

        Returns:
            Cleaned text content
        """
        if not text:
            return ""

        # Remove excessive whitespace and normalize line breaks
        lines = []
        for line in text.split("\n"):
            line = line.strip()
            if line:  # Skip empty lines
                lines.append(line)

        # Join lines with single newlines
        cleaned_text = "\n".join(lines)

        # Remove excessive spaces
        import re

        cleaned_text = re.sub(r" +", " ", cleaned_text)

        return cleaned_text.strip()

    def generate_metadata(self, asset: Asset, extracted_text: str) -> dict:
        """
        Generate PDF-specific metadata

        Args:
            asset: Asset model with metadata
            extracted_text: Extracted text content

        Returns:
            Dictionary containing PDF-specific metadata
        """
        metadata = super().generate_metadata(asset, extracted_text)

        # Add PDF-specific metadata
        metadata.update(
            {
                "document_type": "pdf",
                "extraction_method": "PyPDF2",
                "estimated_pages": extracted_text.count("--- Page")
                if "--- Page" in extracted_text
                else 1,
                "has_page_breaks": "--- Page" in extracted_text,
            }
        )

        return metadata
