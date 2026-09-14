"""
Config management for the AI Engine CLI.

Persists settings (JWT token, server URL, active chat) in
``~/.ai-engine/config.json`` so they survive between invocations.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

_CONFIG_DIR = Path.home() / ".ai-engine"
_CONFIG_FILE = _CONFIG_DIR / "config.json"

_DEFAULTS: dict = {
    "token": None,
    "server_url": "http://localhost:8010",
    "active_chat_id": None,
    "active_agents": [],
    "default_model": None,
}


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------


def _load_raw() -> dict:
    if _CONFIG_FILE.exists():
        try:
            return json.loads(_CONFIG_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _save_raw(data: dict) -> None:
    _CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    _CONFIG_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get(key: str):
    """Return a config value, falling back to the built-in default."""
    raw = _load_raw()
    return raw.get(key, _DEFAULTS.get(key))


def set(key: str, value) -> None:  # noqa: A001
    """Persist a single config value."""
    raw = _load_raw()
    raw[key] = value
    _save_raw(raw)


# Convenience accessors --------------------------------------------------------


def get_token() -> Optional[str]:
    return get("token")


def set_token(token: str) -> None:
    set("token", token)


def get_server_url() -> str:
    return get("server_url") or _DEFAULTS["server_url"]


def set_server_url(url: str) -> None:
    set("server_url", url)


def get_active_chat_id() -> Optional[str]:
    return get("active_chat_id")


def set_active_chat_id(chat_id: Optional[str]) -> None:
    set("active_chat_id", chat_id)


def get_active_agents() -> list[str]:
    val = get("active_agents")
    return val if isinstance(val, list) else []


def set_active_agents(agents: list[str]) -> None:
    set("active_agents", agents)


def get_default_model() -> Optional[str]:
    return get("default_model")


def set_default_model(model: Optional[str]) -> None:
    set("default_model", model)


def ws_url() -> str:
    """Derive the WebSocket base URL from the HTTP server URL."""
    base = get_server_url().rstrip("/")
    # Replace http(s) scheme with ws(s)
    if base.startswith("https://"):
        return "wss://" + base[len("https://") :]
    return "ws://" + base.lstrip("http://")


def config_path() -> Path:
    return _CONFIG_FILE
