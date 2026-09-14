from services.ai_engine_client import AIEngineClient
from utils.exception_handling import NotFoundError

CRED_NAME = "mailchimpApi"


class MailchimpClient:
    """Mailchimp email marketing client.
    Credentials loaded per-request from backend secrets via the user's JWT.
    User must save their Mailchimp API key under app `mailchimpApi`, field `apiKey`.
    The data center (dc) is extracted from the API key suffix e.g. key-us14 → dc=us14.
    """

    @classmethod
    async def initialize(cls, auth: str) -> "MailchimpClient":
        client = AIEngineClient(auth=auth)
        try:
            credential = await client.get_credential(CRED_NAME)
        except NotFoundError:
            raise ValueError(
                "Mailchimp is not configured for this account. "
                "Save your Mailchimp API key as `apiKey` under app `mailchimpApi` in the Secrets page."
            ) from None

        data = credential.data or {}
        api_key = data.get("apiKey", "").strip()
        if not api_key:
            raise ValueError(
                "Mailchimp API key is empty. "
                "Save your API key as `apiKey` under app `mailchimpApi`."
            )

        if "-" not in api_key:
            raise ValueError(
                "Mailchimp API key must include the data center suffix e.g. abc123-us14. "
                "Check your API key format."
            )
        dc = api_key.rsplit("-", 1)[-1]
        base_url = f"https://{dc}.api.mailchimp.com/3.0"
        return cls(api_key=api_key, base_url=base_url, dc=dc)

    def __init__(self, api_key: str, base_url: str, dc: str) -> None:
        self.api_key = api_key
        self.base_url = base_url
        self.dc = dc

    @property
    def auth(self) -> tuple:
        """Mailchimp uses HTTP Basic Auth: any username + API key as password."""
        return ("key", self.api_key)
