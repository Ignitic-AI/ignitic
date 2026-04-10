"""Google Ads API client utilities for MCP tools."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastmcp.exceptions import ToolError

from services.ai_engine_client import AIEngineClient

CRED_NAME = "googleAdsOAuth2Api"
DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token"


class GoogleAdsClient:
    """Thin wrapper around the official Google Ads SDK client."""

    def __init__(
        self,
        sdk_client: Any,
        default_customer_id: Optional[str] = None,
    ) -> None:
        self.sdk_client = sdk_client
        self.default_customer_id = default_customer_id

    @classmethod
    async def build(cls, auth: str) -> "GoogleAdsClient":
        """Build an authenticated client from `googleAdsOAuth2Api` credentials."""
        credential = await AIEngineClient(auth=auth).get_credential(CRED_NAME)
        data = credential.data or {}

        developer_token = str(data.get("developerToken") or "").strip()
        client_id = str(data.get("clientId") or "").strip()
        client_secret = str(data.get("clientSecret") or "").strip()

        oauth_data = data.get("oauthTokenData") or {}
        if not isinstance(oauth_data, dict):
            raise ToolError(
                "Invalid googleAdsOAuth2Api: 'oauthTokenData' must be an object."
            )

        refresh_token = str(oauth_data.get("refresh_token") or "").strip()

        additional_props = data.get("additionalBodyProperties") or {}
        if additional_props and not isinstance(additional_props, dict):
            raise ToolError(
                "Invalid googleAdsOAuth2Api: 'additionalBodyProperties' must be an object."
            )

        token_uri = str(additional_props.get("token_uri") or DEFAULT_TOKEN_URI).strip()

        if not developer_token:
            raise ToolError(
                "googleAdsOAuth2Api is missing required field: data.developerToken"
            )
        if not client_id:
            raise ToolError(
                "googleAdsOAuth2Api is missing required field: data.clientId"
            )
        if not client_secret:
            raise ToolError(
                "googleAdsOAuth2Api is missing required field: data.clientSecret"
            )
        if not refresh_token:
            raise ToolError(
                "googleAdsOAuth2Api is missing required field: data.oauthTokenData.refresh_token"
            )

        sdk_config: Dict[str, Any] = {
            "developer_token": developer_token,
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "token_uri": token_uri,
            "use_proto_plus": True,
        }

        login_customer_id = data.get("loginCustomerId")
        if login_customer_id:
            sdk_config["login_customer_id"] = normalize_customer_id(
                str(login_customer_id)
            )

        from google.ads.googleads.client import GoogleAdsClient as GoogleAdsSdkClient

        sdk_client = GoogleAdsSdkClient.load_from_dict(sdk_config)
        resolved_default_customer = normalize_customer_id(data.get("customer_id"))

        return cls(sdk_client=sdk_client, default_customer_id=resolved_default_customer)

    def require_customer_id(self) -> str:
        resolved = self.default_customer_id
        if not resolved:
            raise ToolError(
                "Google Ads customer_id is required in credentials. Set data.customer_id in googleAdsOAuth2Api."
            )
        return resolved


def normalize_customer_id(customer_id: Optional[str]) -> Optional[str]:
    if customer_id is None:
        return None
    value = str(customer_id).strip().replace("-", "")
    return value or None


def get_auth_from_headers() -> str:
    """Extract Authorization header from MCP request context."""
    from fastmcp.server.dependencies import get_http_headers

    headers = get_http_headers()
    auth = headers.get("Authorization") or headers.get("authorization")
    if not auth:
        raise ToolError("Authorization header is required")
    return auth
