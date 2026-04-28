"""
Unit tests for core/backend_client.py – BackendClient URL building & response handling.
"""

import json
import os
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import HTTPException

from core.backend_client import BackendClient


# ── helpers ───────────────────────────────────────────────────────────
def _fake_auth(token: str = "tok"):
    class _Auth:
        def get_token(self):
            return token
    return _Auth()


def _mock_response(status_code: int, body=None, text: str = ""):
    resp = httpx.Response(status_code=status_code, text=text)
    if body is not None:
        resp = httpx.Response(
            status_code=status_code,
            content=json.dumps(body).encode(),
            headers={"content-type": "application/json"},
        )
    return resp


# ── URL building ──────────────────────────────────────────────────────
class TestBuildUrl:
    @pytest.fixture(autouse=True)
    def _set_env(self, monkeypatch):
        monkeypatch.setattr("core.backend_client.BACKEND_BASE_URL", "http://api.test/v1")

    def test_basic_url(self):
        client = BackendClient(_fake_auth())
        assert client._build_url("users/me") == "http://api.test/v1/users/me"

    def test_strips_leading_slash(self):
        client = BackendClient(_fake_auth())
        assert client._build_url("/users/me") == "http://api.test/v1/users/me"

    def test_strips_trailing_base_slash(self, monkeypatch):
        monkeypatch.setattr("core.backend_client.BACKEND_BASE_URL", "http://api.test/v1/")
        client = BackendClient(_fake_auth())
        assert client._build_url("users/me") == "http://api.test/v1/users/me"


class TestBackendClientInit:
    def test_raises_without_base_url(self, monkeypatch):
        monkeypatch.setattr("core.backend_client.BACKEND_BASE_URL", None)
        with pytest.raises(ValueError, match="BACKEND_BASE_URL"):
            BackendClient(_fake_auth())


# ── Response handling ─────────────────────────────────────────────────
class TestHandleResponse:
    @pytest.fixture(autouse=True)
    def _set_env(self, monkeypatch):
        monkeypatch.setattr("core.backend_client.BACKEND_BASE_URL", "http://api.test")

    @pytest.mark.asyncio
    async def test_200_json(self):
        client = BackendClient(_fake_auth())
        result = await client._handle_response(_mock_response(200, body={"ok": True}))
        assert result == {"ok": True}

    @pytest.mark.asyncio
    async def test_200_plain_text(self):
        client = BackendClient(_fake_auth())
        result = await client._handle_response(_mock_response(200, text="hello"))
        assert result == "hello"

    @pytest.mark.asyncio
    async def test_400_raises_http_exception(self):
        client = BackendClient(_fake_auth())
        with pytest.raises(HTTPException) as exc:
            await client._handle_response(_mock_response(400, body={"detail": "bad input"}))
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_404_raises_http_exception(self):
        client = BackendClient(_fake_auth())
        with pytest.raises(HTTPException) as exc:
            await client._handle_response(_mock_response(404, text="Not found"))
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_500_raises_502(self):
        client = BackendClient(_fake_auth())
        with pytest.raises(HTTPException) as exc:
            await client._handle_response(_mock_response(500, body={"detail": "boom"}))
        assert exc.value.status_code == 502
