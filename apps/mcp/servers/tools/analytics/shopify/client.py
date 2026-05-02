"""Shopify Analytics API client for store performance metrics."""

import json

from shopify import ShopifyResource
from services.ai_engine_client import AIEngineClient
from utils.exception_handling import NotFoundError

# Shopify OAuth credentials are stored by backend under this app key.
CRED_NAME = "shopifyOAuth2Api"


class ShopifyAnalyticsClient:
    """Shopify Analytics client for retrieving store metrics.
    
    Reuses existing Shopify OAuth credentials (same as Shopify Product Agent).
    User must have shopifyOAuth2Api credential saved in Secrets with OAuth tokens.
    """

    @classmethod
    async def initialize(cls, auth: str) -> "ShopifyAnalyticsClient":
        """Initialize client from user's saved Shopify credentials via JWT."""
        client = AIEngineClient(auth=auth)
        try:
            credential = await client.get_credential(CRED_NAME)
        except NotFoundError:
            raise ValueError(
                "Shopify is not configured for this account. "
                "Save your Shopify OAuth credentials under app `shopifyOAuth2Api` in the Secrets page."
            ) from None

        data = credential.data or {}

        oauth_data = data.get("oauthTokenData", {})
        if isinstance(oauth_data, str):
            try:
                oauth_data = json.loads(oauth_data)
            except (json.JSONDecodeError, ValueError):
                oauth_data = {}

        access_token = (
            oauth_data.get("access_token", "").strip()
            if isinstance(oauth_data, dict)
            else ""
        )

        # Backend Shopify OAuth flow stores `shopSubdomain`; keep `shopUrl` fallback for compatibility.
        shop_subdomain = str(data.get("shopSubdomain", "")).strip()
        shop_url = str(data.get("shopUrl", "")).strip()
        if not shop_url and shop_subdomain:
            shop_url = f"{shop_subdomain}.myshopify.com"

        if not access_token or not shop_url:
            raise ValueError(
                "Shopify credentials incomplete. Required: oauthTokenData.access_token and shopSubdomain (or shopUrl)."
            )
        return cls(access_token=access_token, shop_url=shop_url)

    def __init__(self, access_token: str, shop_url: str) -> None:
        self.access_token = access_token
        self.shop_url = shop_url
        ShopifyResource.set_site(f"https://{access_token}@{shop_url}/admin/api/2024-01")
