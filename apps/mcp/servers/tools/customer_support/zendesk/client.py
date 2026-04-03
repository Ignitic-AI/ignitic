"""Zendesk API client for customer support operations."""

import os
import base64
from typing import Optional

from services.ai_engine_client import AIEngineClient
from utils.exception_handling import NotFoundError

CRED_NAME = "zendeskApi"


def _safe_import_dotenv():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass


_safe_import_dotenv()


class ZendeskClient:
    """Zendesk API client for support ticket management.
    
    Credentials loaded per-request from backend secrets via the user's JWT.
    User must save their Zendesk credentials under app `zendeskApi` with fields:
      - email: Support email (igniticai@gmail.com)
      - apiToken: API token (lZQsHOMTAO77HMkCjCjDSYweQ234rM55aGceX2yg)
      - subdomain: Zendesk subdomain (intrace)
    """

    @classmethod
    async def initialize(cls, auth: str) -> "ZendeskClient":
        """Initialize client from user's saved credentials via JWT."""
        client = AIEngineClient(auth=auth)
        try:
            credential = await client.get_credential(CRED_NAME)
        except NotFoundError:
            raise ValueError(
                "Zendesk is not configured for this account. "
                "Save your Zendesk credentials under app `zendeskApi` in the Secrets page:\n"
                "  - email: Your Zendesk email address\n"
                "  - apiToken: Your API token (from Settings > API > Tokens)\n"
                "  - subdomain: Your Zendesk subdomain (e.g. intrace)"
            ) from None

        data = credential.data or {}
        email = data.get("email", "").strip()
        api_token = data.get("apiToken", "").strip()
        subdomain = data.get("subdomain", "").strip()

        if not all([email, api_token, subdomain]):
            raise ValueError(
                "Zendesk credentials incomplete. Required fields:\n"
                "  - email: Your support email\n"
                "  - apiToken: Your API token\n"
                "  - subdomain: Your Zendesk subdomain"
            )
        return cls(email=email, api_token=api_token, subdomain=subdomain)

    def __init__(self, email: str, api_token: str, subdomain: str) -> None:
        self.email = email
        self.api_token = api_token
        self.subdomain = subdomain
        self.base_url = f"https://{subdomain}.zendesk.com/api/v2"

    @property
    def headers(self) -> dict:
        """HTTP Basic Auth header using email/token format."""
        credentials = f"{self.email}/token:{self.api_token}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/json",
        }
