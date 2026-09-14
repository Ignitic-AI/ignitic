import json
import os
import inspect
from pathlib import Path
from typing import Any

import pytest
from dotenv import load_dotenv


# Load repository-level .env once for integration test configuration.
load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env", override=False)


def _is_enabled(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


@pytest.fixture(scope="session")
def require_live_integration() -> None:
    if not _is_enabled(os.getenv("RUN_LIVE_INTEGRATION", "0")):
        pytest.skip(
            "Live integration tests are disabled. Set RUN_LIVE_INTEGRATION=1 to enable."
        )


@pytest.fixture(scope="session")
def live_jwt_bearer(require_live_integration: None) -> str:
    token = os.getenv("JWT_BEARER", "").strip()
    if not token:
        pytest.skip("JWT_BEARER is required for live integration tests.")

    if not token.lower().startswith("bearer "):
        token = f"Bearer {token}"
    return token


@pytest.fixture(scope="session")
def live_chat_id() -> str:
    return os.getenv("LIVE_CHAT_ID", "integration-live")


@pytest.fixture(scope="session")
def live_ads_payloads() -> dict[str, Any]:
    payload_path = Path(
        os.getenv(
            "LIVE_ADS_PAYLOAD_FILE",
            "tests/integration/live_payloads/ads_tool_payloads.json",
        )
    )
    if not payload_path.exists():
        pytest.fail(
            f"Payload file not found: {payload_path}. "
            "Copy tests/integration/live_payloads/ads_tool_payloads.example.json first."
        )

    return json.loads(payload_path.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def live_analytics_payloads() -> dict[str, Any]:
    payload_path = Path(
        os.getenv(
            "LIVE_ANALYTICS_PAYLOAD_FILE",
            "tests/integration/live_payloads/analytics_tool_payloads.json",
        )
    )
    if not payload_path.exists():
        pytest.fail(
            f"Payload file not found: {payload_path}. "
            "Copy tests/integration/live_payloads/analytics_tool_payloads.example.json first."
        )

    return json.loads(payload_path.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def live_business_analyst_payloads() -> dict[str, Any]:
    payload_path = Path(
        os.getenv(
            "LIVE_BUSINESS_ANALYST_PAYLOAD_FILE",
            "tests/integration/live_payloads/business_analyst_tool_payloads.json",
        )
    )
    if not payload_path.exists():
        pytest.fail(
            f"Payload file not found: {payload_path}. "
            "Copy tests/integration/live_payloads/business_analyst_tool_payloads.example.json first."
        )

    return json.loads(payload_path.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def live_crm_payloads() -> dict[str, Any]:
    payload_path = Path(
        os.getenv(
            "LIVE_CRM_PAYLOAD_FILE",
            "tests/integration/live_payloads/crm_tool_payloads.json",
        )
    )
    if not payload_path.exists():
        pytest.fail(
            f"Payload file not found: {payload_path}. "
            "Copy tests/integration/live_payloads/crm_tool_payloads.example.json first."
        )

    return json.loads(payload_path.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def live_customer_support_payloads() -> dict[str, Any]:
    payload_path = Path(
        os.getenv(
            "LIVE_CUSTOMER_SUPPORT_PAYLOAD_FILE",
            "tests/integration/live_payloads/customer_support_tool_payloads.json",
        )
    )
    if not payload_path.exists():
        pytest.fail(
            f"Payload file not found: {payload_path}. "
            "Copy tests/integration/live_payloads/customer_support_tool_payloads.example.json first."
        )

    return json.loads(payload_path.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def live_email_marketing_payloads() -> dict[str, Any]:
    payload_path = Path(
        os.getenv(
            "LIVE_EMAIL_MARKETING_PAYLOAD_FILE",
            "tests/integration/live_payloads/email_marketing_tool_payloads.json",
        )
    )
    if not payload_path.exists():
        pytest.fail(
            f"Payload file not found: {payload_path}. "
            "Copy tests/integration/live_payloads/email_marketing_tool_payloads.example.json first."
        )

    return json.loads(payload_path.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def live_google_drive_payloads() -> dict[str, Any]:
    payload_path = Path(
        os.getenv(
            "LIVE_GOOGLE_DRIVE_PAYLOAD_FILE",
            "tests/integration/live_payloads/google_drive_tool_payloads.json",
        )
    )
    if not payload_path.exists():
        pytest.fail(
            f"Payload file not found: {payload_path}. "
            "Copy tests/integration/live_payloads/google_drive_tool_payloads.example.json first."
        )

    return json.loads(payload_path.read_text(encoding="utf-8"))


def inject_headers_into_tool(tool_fn: Any, auth_header: str, chat_id: str) -> None:
    def _headers(_include_all: bool = False) -> dict[str, str]:
        return {
            "Authorization": auth_header,
            "X-Chat-ID": chat_id,
        }

    tool_fn.__globals__["get_http_headers"] = _headers


def required_params_missing(fn: Any, arguments: dict[str, Any]) -> list[str]:
    signature = inspect.signature(fn)
    missing: list[str] = []

    for param in signature.parameters.values():
        if param.kind not in (
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
            inspect.Parameter.KEYWORD_ONLY,
        ):
            continue
        if param.default is inspect.Parameter.empty and param.name not in arguments:
            missing.append(param.name)

    return missing


def payload_for_tool(
    payloads: dict[str, Any], identifier: str, tool_name: str
) -> dict[str, Any]:
    by_identifier = payloads.get("by_identifier", {})
    by_name = payloads.get("by_name", {})

    if identifier in by_identifier:
        return by_identifier[identifier]

    return by_name.get(tool_name, {})
