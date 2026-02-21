import json

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from services.ai_engine_client import AIEngineClient

CRED_NAME = "googleDriveOAuth2Api"


class GoogleDriveClient:
    """
    Builds an authenticated Google Drive API service by fetching OAuth2
    credentials from the AI Engine credential store.

    The credential entry is stored under the key ``googleDriveOAuth2Api`` and
    contains the following named secrets:

    - ``clientId``       - OAuth2 client-id
    - ``clientSecret``   - OAuth2 client-secret
    - ``oauthTokenData`` - JSON blob with ``access_token``, ``refresh_token``,
                           ``token_type``, ``expires_at``, etc.
    - ``additionalBodyProperties`` - JSON blob with ``token_uri``, ``scopes``,
                                     ``redirect_uri``, etc.
    """

    @classmethod
    async def build_service(cls, auth: str):
        """
        Fetch credentials from the AI Engine, build and return an authorised
        Google Drive v3 service resource.
        """
        credential = await AIEngineClient(auth=auth).get_credential(CRED_NAME)
        data = credential.data  # dict keyed by secret ``name``

        client_id: str = data["clientId"]
        client_secret: str = data["clientSecret"]

        oauth_token_raw = data.get("oauthTokenData", "{}")
        if isinstance(oauth_token_raw, str):
            oauth_token: dict = json.loads(oauth_token_raw)
        else:
            oauth_token = oauth_token_raw

        additional_raw = data.get("additionalBodyProperties", "{}")
        if isinstance(additional_raw, str):
            additional: dict = json.loads(additional_raw)
        else:
            additional = additional_raw

        token_uri: str = additional.get(
            "token_uri", "https://oauth2.googleapis.com/token"
        )
        scopes: list = additional.get(
            "scopes", ["https://www.googleapis.com/auth/drive"]
        )

        creds = Credentials(
            token=oauth_token.get("access_token"),
            refresh_token=oauth_token.get("refresh_token"),
            token_uri=token_uri,
            client_id=client_id,
            client_secret=client_secret,
            scopes=scopes,
        )

        # Refresh if expired (uses refresh_token automatically)
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())

        service = build("drive", "v3", credentials=creds, cache_discovery=False)
        return service


def get_auth_from_headers() -> str:
    """Helper to extract the auth token from fastmcp HTTP headers."""
    from fastmcp.server.dependencies import get_http_headers

    headers = get_http_headers()
    auth = headers.get("Authorization") or headers.get("authorization")
    if not auth:
        raise ValueError("Authorization header is required")
    return auth
