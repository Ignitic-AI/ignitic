"""
Unit tests for the document processors factory (services/document_processors).
"""

import pytest
from datetime import datetime
from models.asset import Asset
from services.document_processors import ProcessorFactory


def _make_asset(mime_type: str) -> Asset:
    now = datetime.now()
    return Asset(
        id="a1",
        user_id="u1",
        category="test",
        title="Test",
        storage_provider="local",
        path="/test",
        url="https://example.com/test",
        mime_type=mime_type,
        file_ext="pdf",
        size_bytes=100,
        created_by="u1",
        created_at=now,
        updated_at=now,
    )


class TestProcessorFactory:
    def test_pdf_supported(self):
        asset = _make_asset("application/pdf")
        assert ProcessorFactory.is_supported(asset)

    def test_text_plain_supported(self):
        asset = _make_asset("text/plain")
        assert ProcessorFactory.is_supported(asset)

    def test_unsupported_mime(self):
        asset = _make_asset("video/mp4")
        assert not ProcessorFactory.is_supported(asset)

    def test_get_processor_returns_correct_type(self):
        asset = _make_asset("application/pdf")
        processor = ProcessorFactory.get_processor(asset)
        assert processor is not None
        assert "PDF" in processor.__class__.__name__

    def test_get_processor_returns_none_for_unsupported(self):
        asset = _make_asset("application/x-unknown")
        processor = ProcessorFactory.get_processor(asset)
        assert processor is None

    def test_get_supported_mime_types_is_nonempty(self):
        types = ProcessorFactory.get_supported_mime_types()
        assert len(types) > 0
        assert "application/pdf" in types

    def test_get_processor_info(self):
        info = ProcessorFactory.get_processor_info()
        assert "PDFDocumentProcessor" in info
        assert "TextDocumentProcessor" in info
        assert "DOCXDocumentProcessor" in info
