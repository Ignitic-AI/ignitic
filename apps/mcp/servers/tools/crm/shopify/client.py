
import shopify

from services.ai_engine_client import AIEngineClient


class ShopifyClient:

    @classmethod
    async def initialize(cls, auth: str):
        credential = await AIEngineClient().get_credential(auth)
        return cls(
            shopUrl=credential.data["shopUrl"],
            access_token=credential.data["access_token"],
        )
    
    def __init__(self, shopUrl, access_token) -> None:
        self.shopUrl = shopUrl
        self.access_token = access_token
        self.api_version = "2026-01"

    def create_session(self):
        return shopify.Session.temp(self.shopUrl, self.api_version, self.access_token)

