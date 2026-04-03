from services.ai_engine_client import AIEngineClient
from utils.exception_handling import NotFoundError

CRED_NAME = "sendInBlueApi"

_BASE_URL = "https://api.brevo.com/v3"


class BrevoClient:
    """Brevo (SendInBlue) email marketing client.
    Credentials are loaded per-request from backend secrets via the user's JWT.
    The user must save their Brevo API key under app `sendInBlueApi`, secret field `apiKey`.
    """

    @classmethod
    async def initialize(cls, auth: str) -> "BrevoClient":
        client = AIEngineClient(auth=auth)
        try:
            credential = await client.get_credential(CRED_NAME)
        except NotFoundError:
            raise ValueError(
                "Brevo is not configured for this account. "
                "Save your Brevo API key as secret `apiKey` under app `sendInBlueApi` in the Secrets page."
            ) from None

        data = credential.data or {}
        api_key = data.get("apiKey", "").strip()
        if not api_key:
            raise ValueError(
                "Brevo API key is empty. "
                "Save your Brevo API key as secret `apiKey` under app `sendInBlueApi`."
            )
        return cls(api_key=api_key)

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.base_url = _BASE_URL

    @property
    def headers(self) -> dict:
        return {
            "api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
