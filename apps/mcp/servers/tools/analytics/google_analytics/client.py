"""Google Analytics 4 (GA4) API client for website analytics.

Uses Google OAuth2 credentials to authenticate with GA4 API.
Reuses existing googleAnalyticsOAuth2Api credential pattern (similar to Google Drive).
"""

import json
from typing import Optional

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from services.ai_engine_client import AIEngineClient
from utils.exception_handling import NotFoundError

CRED_NAME = "googleAnalyticsOAuth2Api"


class GoogleAnalytics4Client:
    """Google Analytics 4 API client.
    
    Credentials loaded per-request from backend secrets via the user's JWT.
    User must save their Google Analytics OAuth credentials under app `googleAnalyticsOAuth2Api`.
    
    Requires:
      - clientId: OAuth client ID
      - clientSecret: OAuth client secret
      - oauthTokenData: {access_token, refresh_token, ...}
      - additionalBodyProperties: {token_uri, scopes, ...}
    """

    @classmethod
    async def initialize(cls, auth: str, property_id: str) -> "GoogleAnalytics4Client":
        """Initialize GA4 client from saved Google OAuth credentials.
        
        Args:
            auth: JWT auth token from HTTP headers
            property_id: GA4 property ID (e.g., "properties/123456789")
        """
        client = AIEngineClient(auth=auth)
        try:
            credential = await client.get_credential(CRED_NAME)
        except NotFoundError:
            raise ValueError(
                "Google Analytics is not configured for this account. "
                "Save your Google OAuth credentials under app `googleAnalyticsOAuth2Api` in the Secrets page."
            ) from None

        data = credential.data or {}
        
        client_id = data.get("clientId", "").strip()
        client_secret = data.get("clientSecret", "").strip()
        
        oauth_token_raw = data.get("oauthTokenData", "{}")
        if isinstance(oauth_token_raw, str):
            oauth_token = json.loads(oauth_token_raw)
        else:
            oauth_token = oauth_token_raw
        
        additional_raw = data.get("additionalBodyProperties", "{}")
        if isinstance(additional_raw, str):
            additional = json.loads(additional_raw)
        else:
            additional = additional_raw
        
        token_uri = additional.get("token_uri", "https://oauth2.googleapis.com/token")
        scopes = additional.get("scopes", ["https://www.googleapis.com/auth/analytics.readonly"])
        
        if not all([client_id, client_secret, oauth_token.get("access_token")]):
            raise ValueError(
                "Google Analytics credentials incomplete. "
                "Required: clientId, clientSecret, oauthTokenData.access_token"
            )
        
        creds = Credentials(
            token=oauth_token.get("access_token"),
            refresh_token=oauth_token.get("refresh_token"),
            token_uri=token_uri,
            client_id=client_id,
            client_secret=client_secret,
            scopes=scopes,
        )
        
        # Refresh if expired
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
        
        service = build("analyticsdata", "v1beta", credentials=creds, cache_discovery=False)
        return cls(service=service, property_id=property_id)

    def __init__(self, service, property_id: str) -> None:
        self.service = service
        self.property_id = property_id
