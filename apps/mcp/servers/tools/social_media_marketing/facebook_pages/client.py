"""
Facebook Pages client.

Builds an authenticated Facebook Graph API client by fetching the user
access token from the AI Engine credential store (``facebookGraphApi``),
then exchanging it for a Page access token via ``/me/accounts``.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import httpx
from fastmcp.exceptions import ToolError

from services.ai_engine_client import AIEngineClient

CRED_NAME = "facebookGraphApi"
GRAPH_API_BASE_URL = "https://graph.facebook.com/v25.0"


class FacebookPageClient:
    """
    Thin async wrapper around the Facebook Graph API for Page operations.

    Usage::

        client = await FacebookPageClient.build(auth_header)
        result = await client.request("GET", f"{client.page_id}/posts",
                                      params={"fields": "id,message"})
    """

    def __init__(
        self,
        user_access_token: str,
        page_access_token: str,
        page_id: str,
    ) -> None:
        self.user_access_token = user_access_token
        self.page_access_token = page_access_token
        self.page_id = page_id
        self._http = httpx.AsyncClient(timeout=30, follow_redirects=True)

    # ------------------------------------------------------------------ #
    # Factory                                                              #
    # ------------------------------------------------------------------ #

    @classmethod
    async def build(cls, auth: str) -> "FacebookPageClient":
        """
        Fetch the ``facebookGraphApi`` credential from the AI Engine, then
        retrieve the Page access token from ``/me/accounts``.
        """
        credential = await AIEngineClient(auth=auth).get_credential(CRED_NAME)
        data = credential.data

        user_access_token: str = data.get("accessToken", "")
        if not user_access_token:
            raise ToolError(
                "The 'facebookGraphApi' credential does not contain an 'accessToken'."
            )

        page_name: str = data.get("pageName", "")
        if not page_name:
            raise ToolError(
                "The 'facebookGraphApi' credential does not contain a 'pageName'."
            )

        # Exchange the user token for a page token
        page_access_token, page_id = await cls._fetch_page_token(
            user_access_token=user_access_token,
            page_name=page_name,
        )
        return cls(
            user_access_token=user_access_token,
            page_access_token=page_access_token,
            page_id=page_id,
        )

    @staticmethod
    async def _fetch_page_token(
        user_access_token: str,
        page_name: str,
    ) -> tuple[str, str]:
        """
        Call ``/me/accounts`` to obtain the selected Page's access token and ID.
        """
        url = f"{GRAPH_API_BASE_URL}/me/accounts"
        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.get(
                url,
                params={"access_token": user_access_token},
            )
            resp.raise_for_status()
            body = resp.json()

        pages = body.get("data", [])
        if not pages:
            raise ToolError(
                "No Facebook Pages found for this user. "
                "Make sure the user access token has the 'pages_manage_posts' permission."
            )

        normalized_page_name = page_name.strip().lower()
        for page in pages:
            if str(page.get("name", "")).strip().lower() == normalized_page_name:
                return page["access_token"], page["id"]

        available_page_names = [str(page.get("name", "")) for page in pages]
        raise ToolError(
            "Configured Facebook Page was not found in /me/accounts response. "
            f"Configured pageName: '{page_name}'. "
            f"Available pages: {available_page_names}"
        )

    # ------------------------------------------------------------------ #
    # Generic request helper                                               #
    # ------------------------------------------------------------------ #

    async def request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Send a request to the Graph API.

        The page access token is injected automatically as a query parameter.
        """
        url = f"{GRAPH_API_BASE_URL}/{endpoint}"
        params = dict(params or {})
        params["access_token"] = self.page_access_token

        resp = await self._http.request(method, url, params=params, json=json_body)

        # Surface Graph API errors clearly
        if resp.status_code >= 400:
            try:
                error_body = resp.json()
            except Exception:
                error_body = resp.text
            raise ToolError(
                f"Facebook Graph API error ({resp.status_code}): {error_body}"
            )

        return resp.json()


# ------------------------------------------------------------------ #
# Helper to extract auth from MCP request headers                      #
# ------------------------------------------------------------------ #


def get_auth_from_headers() -> str:
    """Extract the Authorization header forwarded by the MCP transport."""
    from fastmcp.server.dependencies import get_http_headers

    headers = get_http_headers()
    auth = headers.get("Authorization") or headers.get("authorization")
    if not auth:
        raise ValueError("Authorization header is required")
    return auth
