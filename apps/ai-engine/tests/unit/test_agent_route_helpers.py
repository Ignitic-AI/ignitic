"""
Unit tests for pure helper functions in api/agents/agent_routes.py.

These test the synchronous utility functions without touching Beanie/MongoDB.
"""

import pytest
from fastapi import HTTPException

from api.agents.agent_routes import (
    _normalize_identifier,
    _validate_custom_identifier,
    _get_root_cause,
)


class TestNormalizeIdentifier:
    def test_lowercase(self):
        assert _normalize_identifier("MyAgent") == "myagent"

    def test_replaces_special_chars(self):
        assert _normalize_identifier("my-cool agent!") == "my_cool_agent"

    def test_collapses_underscores(self):
        assert _normalize_identifier("a___b") == "a_b"

    def test_strips_leading_trailing(self):
        assert _normalize_identifier("  _hello_ ") == "hello"

    def test_empty_string(self):
        assert _normalize_identifier("") == ""

    def test_none_input(self):
        assert _normalize_identifier(None) == ""


class TestValidateCustomIdentifier:
    def test_valid_identifier(self):
        _validate_custom_identifier("my_custom_agent")  # no exception

    def test_reserved_prebuilt(self):
        with pytest.raises(HTTPException) as exc:
            _validate_custom_identifier("marketer")
        assert exc.value.status_code == 409

    def test_reserved_super_agent(self):
        with pytest.raises(HTTPException) as exc:
            _validate_custom_identifier("super_agent")
        assert exc.value.status_code == 409

    def test_too_short(self):
        with pytest.raises(HTTPException) as exc:
            _validate_custom_identifier("ab")
        assert exc.value.status_code == 422

    def test_too_long(self):
        with pytest.raises(HTTPException) as exc:
            _validate_custom_identifier("a" * 65)
        assert exc.value.status_code == 422

    def test_invalid_chars(self):
        with pytest.raises(HTTPException) as exc:
            _validate_custom_identifier("my-agent")
        assert exc.value.status_code == 422


class TestGetRootCause:
    def test_plain_exception(self):
        exc = ValueError("boom")
        assert _get_root_cause(exc) is exc

    def test_nested_exception_group(self):
        inner = RuntimeError("root cause")
        outer = ExceptionGroup("group", [inner])
        assert _get_root_cause(outer) is inner

    def test_deeply_nested(self):
        deepest = TypeError("deep")
        mid = ExceptionGroup("mid", [deepest])
        outer = ExceptionGroup("outer", [mid])
        assert _get_root_cause(outer) is deepest
