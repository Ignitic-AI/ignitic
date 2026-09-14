"""
Text Document Processor - Handles plain text file processing

Processes plain text files, markdown files, and other text-based formats
for vector storage operations.
"""

import logging
from models.asset import Asset
from .base_document_processor import BaseDocumentProcessor

from loguru import logger


class TextDocumentProcessor(BaseDocumentProcessor):
    """Document processor for plain text files"""

    def __init__(self):
        super().__init__()
        self.supported_mime_types = [
            "text/plain",
            "text/markdown",
            "text/html",
            "text/csv",
            "application/json",
        ]
        self.max_chunk_size = 1000
        self.chunk_overlap = 200

    def validate_content(self, content: bytes, asset: Asset) -> bool:
        """
        Validate if the content is valid text

        Args:
            content: Raw text content as bytes
            asset: Asset model with metadata

        Returns:
            Boolean indicating if content is valid text
        """
        try:
            # Check if content is not empty
            if not content or len(content) == 0:
                logger.warning(f"⚠️ Empty content for asset: {asset.id}")
                return False

            # Try to decode as UTF-8
            try:
                content.decode("utf-8")
            except UnicodeDecodeError:
                # Try other common encodings
                for encoding in ["latin-1", "cp1252", "iso-8859-1"]:
                    try:
                        content.decode(encoding)
                        break
                    except UnicodeDecodeError:
                        continue
                else:
                    logger.warning(
                        f"⚠️ Cannot decode text content for asset: {asset.id}"
                    )
                    return False

            return True

        except Exception as e:
            logger.error(f"❌ Error validating text content for {asset.id}: {e}")
            return False

    def extract_text(self, content: bytes, asset: Asset) -> str:
        """
        Extract text content from text-based files

        Args:
            content: Raw text content as bytes
            asset: Asset model with metadata

        Returns:
            Extracted text content as string

        Raises:
            Exception: If text extraction fails
        """
        try:
            logger.debug(f"📄 Extracting text from {asset.mime_type}: {asset.id}")

            # Try to decode with UTF-8 first
            try:
                text = content.decode("utf-8")
            except UnicodeDecodeError:
                # Try other common encodings
                for encoding in ["latin-1", "cp1252", "iso-8859-1"]:
                    try:
                        text = content.decode(encoding)
                        logger.debug(f"Decoded text using {encoding} encoding")
                        break
                    except UnicodeDecodeError:
                        continue
                else:
                    raise Exception(
                        "Unable to decode text content with any supported encoding"
                    )

            # Process based on MIME type
            if asset.mime_type == "text/html":
                text = self._clean_html_content(text)
            elif asset.mime_type == "text/csv":
                text = self._process_csv_content(text)
            elif asset.mime_type == "application/json":
                text = self._process_json_content(text)
            else:
                # Plain text or markdown - minimal processing
                text = self._clean_text_content(text)

            if not text.strip():
                raise Exception("No text content found after processing")

            logger.debug(
                f"✅ Extracted {len(text)} characters from text file: {asset.id}"
            )
            return text

        except Exception as e:
            logger.error(f"❌ Error extracting text from {asset.id}: {e}")
            raise Exception(f"Text extraction failed: {str(e)}")

    def _clean_text_content(self, text: str) -> str:
        """
        Clean plain text content

        Args:
            text: Raw text content

        Returns:
            Cleaned text content
        """
        if not text:
            return ""

        # Normalize line endings
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        # Remove excessive whitespace while preserving paragraph structure
        lines = []
        for line in text.split("\n"):
            line = line.strip()
            lines.append(line)  # Keep empty lines for paragraph separation

        # Join lines and remove excessive empty lines (more than 2 consecutive)
        text = "\n".join(lines)
        import re

        text = re.sub(r"\n{3,}", "\n\n", text)

        return text.strip()

    def _clean_html_content(self, html_content: str) -> str:
        """
        Extract and clean text from HTML content

        Args:
            html_content: Raw HTML content

        Returns:
            Cleaned text content without HTML tags
        """
        try:
            # Try to use BeautifulSoup if available
            try:
                from bs4 import BeautifulSoup

                soup = BeautifulSoup(html_content, "html.parser")

                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.decompose()

                # Get text and clean it
                text = soup.get_text()

            except ImportError:
                # Fallback: simple HTML tag removal with regex
                import re

                text = re.sub(
                    r"<script[^>]*>.*?</script>",
                    "",
                    html_content,
                    flags=re.DOTALL | re.IGNORECASE,
                )
                text = re.sub(
                    r"<style[^>]*>.*?</style>",
                    "",
                    text,
                    flags=re.DOTALL | re.IGNORECASE,
                )
                text = re.sub(r"<[^>]+>", "", text)

                # Decode HTML entities
                import html

                text = html.unescape(text)

            return self._clean_text_content(text)

        except Exception as e:
            logger.warning(f"⚠️ Error cleaning HTML content, using raw text: {e}")
            return self._clean_text_content(html_content)

    def _process_csv_content(self, csv_content: str) -> str:
        """
        Process CSV content for text extraction

        Args:
            csv_content: Raw CSV content

        Returns:
            Processed text representation of CSV data
        """
        try:
            import csv
            import io

            # Parse CSV and convert to readable text
            csv_reader = csv.reader(io.StringIO(csv_content))

            lines = []
            for row_num, row in enumerate(csv_reader):
                if row_num == 0:
                    # Header row
                    lines.append("Headers: " + ", ".join(row))
                else:
                    # Data rows
                    non_empty_cells = [cell.strip() for cell in row if cell.strip()]
                    if non_empty_cells:
                        lines.append(
                            "Row " + str(row_num) + ": " + ", ".join(non_empty_cells)
                        )

                # Limit rows for large CSVs
                if row_num > 100:
                    lines.append("... (truncated after 100 rows)")
                    break

            return "\n".join(lines)

        except Exception as e:
            logger.warning(f"⚠️ Error processing CSV content, using raw text: {e}")
            return self._clean_text_content(csv_content)

    def _process_json_content(self, json_content: str) -> str:
        """
        Process JSON content for text extraction

        Args:
            json_content: Raw JSON content

        Returns:
            Processed text representation of JSON data
        """
        try:
            import json

            # Parse JSON and convert to readable text
            data = json.loads(json_content)

            def json_to_text(obj, prefix=""):
                """Recursively convert JSON object to readable text"""
                if isinstance(obj, dict):
                    lines = []
                    for key, value in obj.items():
                        if isinstance(value, (dict, list)):
                            lines.append(f"{prefix}{key}:")
                            lines.extend(json_to_text(value, prefix + "  "))
                        else:
                            lines.append(f"{prefix}{key}: {value}")
                    return lines
                elif isinstance(obj, list):
                    lines = []
                    for i, item in enumerate(obj):
                        if isinstance(item, (dict, list)):
                            lines.append(f"{prefix}Item {i + 1}:")
                            lines.extend(json_to_text(item, prefix + "  "))
                        else:
                            lines.append(f"{prefix}Item {i + 1}: {item}")
                    return lines
                else:
                    return [f"{prefix}{obj}"]

            text_lines = json_to_text(data)
            return "\n".join(text_lines)

        except Exception as e:
            logger.warning(f"⚠️ Error processing JSON content, using raw text: {e}")
            return self._clean_text_content(json_content)

    def generate_metadata(self, asset: Asset, extracted_text: str) -> dict:
        """
        Generate text-specific metadata

        Args:
            asset: Asset model with metadata
            extracted_text: Extracted text content

        Returns:
            Dictionary containing text-specific metadata
        """
        metadata = super().generate_metadata(asset, extracted_text)

        # Add text-specific metadata
        metadata.update(
            {
                "document_type": "text",
                "extraction_method": "direct_text_processing",
                "line_count": extracted_text.count("\n") + 1,
                "word_count": len(extracted_text.split()) if extracted_text else 0,
                "encoding_detected": "utf-8",  # Simplified - could be enhanced
            }
        )

        return metadata
