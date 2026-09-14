import shopify

from services.ai_engine_client import AIEngineClient


class ShopifyClient:
    @classmethod
    async def initialize(cls, auth: str):
        credential = await AIEngineClient(auth=auth).get_credential("shopifyOAuth2Api")
        shop_subdomain = credential.data["shopSubdomain"]
        shop_url = f"{shop_subdomain}.myshopify.com"
        access_token = credential.data["oauthTokenData"]["access_token"]
        return cls(
            shopUrl=shop_url,
            access_token=access_token,
        )

    def __init__(self, shopUrl, access_token) -> None:
        self.shopUrl = shopUrl
        self.access_token = access_token
        self.api_version = "2026-01"

    def create_session(self):
        return shopify.Session.temp(self.shopUrl, self.api_version, self.access_token)
