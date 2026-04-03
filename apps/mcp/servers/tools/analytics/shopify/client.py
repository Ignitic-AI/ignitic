"""Shopify Analytics API client for store performance metrics."""

from shopify import ShopifyResource
from services.ai_engine_client import AIEngineClient
from utils.exception_handling import NotFoundError

CRED_NAME = "shopifyApi"


class ShopifyAnalyticsClient:
    """Shopify Analytics client for retrieving store metrics.
    
    Reuses existing Shopify OAuth credentials (same as Shopify Product Agent).
    User must have shopifyApi credential saved in Secrets with OAuth tokens.
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
                "Save your Shopify OAuth credentials under app `shopifyApi` in the Secrets page."
            ) from None

        data = credential.data or {}
        access_token = data.get("oauthTokenData", {}).get("access_token", "").strip() if isinstance(data.get("oauthTokenData"), dict) else ""
        shop_url = data.get("shopUrl", "").strip()

        if not access_token or not shop_url:
            raise ValueError(
                "Shopify credentials incomplete. Required: access_token (from oauthTokenData) and shopUrl."
            )
        return cls(access_token=access_token, shop_url=shop_url)

    def __init__(self, access_token: str, shop_url: str) -> None:
        self.access_token = access_token
        self.shop_url = shop_url
        ShopifyResource.set_site(f"https://{access_token}@{shop_url}/admin/api/2024-01")
