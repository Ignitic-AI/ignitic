"""
Instagram Graph API client.

Builds an authenticated Instagram Graph API client by fetching the user
access token from the AI Engine credential store (``facebookGraphApi``),
then discovering the Instagram Business Account ID via the connected
Facebook Page.

Unlike the Facebook Pages client, no separate page token is required —
the same user access token is used for all Instagram Graph API calls.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import httpx
from fastmcp.exceptions import ToolError

from services.ai_engine_client import AIEngineClient

CRED_NAME = "facebookGraphApi"
GRAPH_API_BASE_URL = "https://graph.facebook.com/v25.0"


class InstagramClient:
    """
    Thin async wrapper around the Instagram Graph API.

    Usage::

        client = await InstagramClient.build(auth_header)
        result = await client.request("GET", f"{client.ig_account_id}/media",
                                      params={"fields": "id,caption"})
    """

    def __init__(
        self,
        access_token: str,
        ig_account_id: str,
    ) -> None:
        self.access_token = access_token
        self.ig_account_id = ig_account_id
        self._http = httpx.AsyncClient(timeout=30, follow_redirects=True)

    # ------------------------------------------------------------------ #
    # Factory                                                              #
    # ------------------------------------------------------------------ #

    @classmethod
    async def build(cls, auth: str) -> "InstagramClient":
        """
        Fetch the ``facebookGraphApi`` credential from the AI Engine, then
        discover the Instagram Business Account ID via ``/me/accounts``.
        """
        credential = await AIEngineClient(auth=auth).get_credential(CRED_NAME)
        data = credential.data

        access_token: str = data.get("accessToken", "")
        if not access_token:
            raise ToolError(
                "The 'facebookGraphApi' credential does not contain an 'accessToken'."
            )

        page_name: str = data.get("pageName", "")
        if not page_name:
            raise ToolError(
                "The 'facebookGraphApi' credential does not contain a 'pageName'."
            )

        ig_account_id = await cls._fetch_ig_account_id(
            access_token=access_token,
            page_name=page_name,
        )
        return cls(access_token=access_token, ig_account_id=ig_account_id)

    @staticmethod
    async def _fetch_ig_account_id(
        access_token: str,
        page_name: str,
    ) -> str:
        """
        Call ``/me/accounts`` to find the configured Facebook Page, then read
        its ``instagram_business_account`` field to obtain the IG account ID.
        """
        url = f"{GRAPH_API_BASE_URL}/me/accounts"
        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.get(
                url,
                params={
                    "access_token": access_token,
                    "fields": "id,name,instagram_business_account",
                },
            )
            resp.raise_for_status()
            body = resp.json()

        pages = body.get("data", [])
        if not pages:
            raise ToolError(
                "No Facebook Pages found for this user. "
                "Ensure your access token has the 'pages_show_list' permission."
            )

        normalized_page_name = page_name.strip().lower()
        for page in pages:
            if str(page.get("name", "")).strip().lower() == normalized_page_name:
                ig_account = page.get("instagram_business_account")
                if ig_account and ig_account.get("id"):
                    return ig_account["id"]

                raise ToolError(
                    "The configured Facebook Page does not have a linked Instagram "
                    f"Business Account. Configured pageName: '{page_name}'."
                )

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

        The user access token is injected automatically as a query parameter.
        """
        url = f"{GRAPH_API_BASE_URL}/{endpoint}"
        params = dict(params or {})
        params["access_token"] = self.access_token

        resp = await self._http.request(method, url, params=params, json=json_body)

        # Surface Graph API errors clearly
        if resp.status_code >= 400:
            try:
                error_body = resp.json()
            except Exception:
                error_body = resp.text
            raise ToolError(
                f"Instagram Graph API error ({resp.status_code}): {error_body}"
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
