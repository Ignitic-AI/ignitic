"""
Meta Ads Graph API client.

Builds an authenticated Meta Ads client by fetching the user access token
from the AI Engine credential store (``facebookGraphApi``).
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional

import httpx
from fastmcp.exceptions import ToolError

from services.ai_engine_client import AIEngineClient

CRED_NAME = "facebookGraphApi"
GRAPH_API_BASE_URL = "https://graph.facebook.com/v25.0"


class MetaAdsClient:
    """Thin async wrapper around the Meta Ads Graph API."""

    def __init__(
        self,
        access_token: str,
        default_account_id: Optional[str] = None,
        page_name: Optional[str] = None,
    ) -> None:
        self.access_token = access_token
        self.default_account_id = default_account_id
        self.page_name = page_name
        self._http = httpx.AsyncClient(timeout=30, follow_redirects=True)

    @classmethod
    async def build(cls, auth: str) -> "MetaAdsClient":
        """Build client from the ``facebookGraphApi`` AI Engine credential."""
        credential = await AIEngineClient(auth=auth).get_credential(CRED_NAME)
        data = credential.data

        access_token: str = data.get("accessToken", "")
        if not access_token:
            raise ToolError(
                "The 'facebookGraphApi' credential does not contain an 'accessToken'."
            )

        raw_account_id = data.get("adAccountId") or data.get("accountId")
        default_account_id = (
            normalize_account_id(raw_account_id) if raw_account_id else None
        )
        page_name = data.get("pageName")

        return cls(
            access_token=access_token,
            default_account_id=default_account_id,
            page_name=page_name,
        )

    def require_account_id(self, account_id: Optional[str]) -> str:
        """Resolve account ID from tool input or credential defaults."""
        resolved = account_id or self.default_account_id
        if not resolved:
            raise ToolError(
                "Meta ad account ID is required. Provide 'account_id' or set "
                "'adAccountId' in the facebookGraphApi credential."
            )
        return normalize_account_id(resolved)

    async def request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Send an authenticated request to the Graph API."""
        endpoint = endpoint.lstrip("/")
        url = f"{GRAPH_API_BASE_URL}/{endpoint}"

        request_params = dict(params or {})
        request_params["access_token"] = self.access_token

        resp = await self._http.request(
            method=method,
            url=url,
            params=request_params,
            json=json_body,
        )

        if resp.status_code >= 400:
            try:
                error_body: Any = resp.json()
            except Exception:
                error_body = resp.text
            raise ToolError(
                f"Meta Graph API error ({resp.status_code}) on '{endpoint}': {error_body}"
            )

        try:
            return resp.json()
        except json.JSONDecodeError:
            return {"raw": resp.text}


def normalize_account_id(account_id: str) -> str:
    """Normalize account IDs to ``act_<id>`` format."""
    value = str(account_id).strip()
    if not value:
        raise ToolError("Account ID cannot be empty.")
    if value.startswith("act_"):
        return value
    return f"act_{value}"


def get_auth_from_headers() -> str:
    """Extract the Authorization header forwarded by the MCP transport."""
    from fastmcp.server.dependencies import get_http_headers

    headers = get_http_headers()
    auth = headers.get("Authorization") or headers.get("authorization")
    if not auth:
        raise ValueError("Authorization header is required")
    return auth
