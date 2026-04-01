from services.ai_engine_client import AIEngineClient
from utils.exception_handling import NotFoundError

CRED_NAME = "hubspotPrivateApp"
_CRED_LEGACY_APP = "hubspotDeveloperApi"

_DEFAULT_BASE = "https://api.hubapi.com"


def _token_from_credential_data(data: dict) -> str | None:
    """Prefer accessToken (matches HubSpot UI); legacy apiKey still supported."""
    for key in ("accessToken", "apiKey", "privateAppToken", "developerApiKey"):
        raw = data.get(key)
        if raw is None:
            continue
        s = str(raw).strip()
        if s:
            return s
    return None


class HubspotClient:
    """HubSpot CRM (Bearer). Token is loaded per request from backend secrets via the user's JWT — same idea as Shopify/Drive."""

    @classmethod
    async def initialize(cls, auth: str) -> "HubspotClient":
        client = AIEngineClient(auth=auth)
        try:
            credential = await client.get_credential(CRED_NAME)
        except NotFoundError:
            try:
                credential = await client.get_credential(_CRED_LEGACY_APP)
            except NotFoundError:
                raise ValueError(
                    f"HubSpot is not configured for this account. Save your private app access token as secret "
                    f"`accessToken` under backend app `{CRED_NAME}` (same secrets API as other integrations). "
                    f"Legacy app `{_CRED_LEGACY_APP}` / secret `apiKey` still work if already stored."
                ) from None
        data = credential.data or {}
        token = _token_from_credential_data(data)
        base = _DEFAULT_BASE
        if data.get("baseUrl"):
            base = str(data["baseUrl"]).rstrip("/")
        if not token:
            raise ValueError(
                f"HubSpot is not configured for this account. Save your private app access token as secret "
                f"`accessToken` under backend app `{CRED_NAME}` (same secrets API as other integrations). "
                f"Legacy app `{_CRED_LEGACY_APP}` / secret `apiKey` still work if already stored."
            )
        return cls(base_url=base, access_token=token)

    def __init__(self, base_url: str, access_token: str) -> None:
        self.base_url = base_url
        self.access_token = access_token
