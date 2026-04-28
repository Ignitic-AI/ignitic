"""
Unit tests for core/auth.py – AuthProvider, JWT validation helpers.
"""

import time
from datetime import datetime, timezone

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from core.auth import AuthProvider, verify_jwt_token

# Use a stable secret/algo pair for all test JWTs.
_SECRET = "test-secret-key-for-unit-tests-32b+"
_ALGO = "HS256"


def _make_token(payload: dict, secret: str = _SECRET, algo: str = _ALGO) -> str:
    return jwt.encode(payload, secret, algorithm=algo)


@pytest.fixture(autouse=True)
def _patch_jwt_config(monkeypatch):
    """Ensure auth module reads our test secret."""
    import core.auth as auth_mod
    monkeypatch.setattr(auth_mod, "JWT_SECRET", _SECRET)
    monkeypatch.setattr(auth_mod, "JWT_ALGORITHM", _ALGO)


# ─── AuthProvider construction ────────────────────────────────────────
class TestAuthProviderInit:
    def test_missing_auth_raises(self):
        with pytest.raises(HTTPException) as exc:
            AuthProvider(None)  # type: ignore[arg-type]
        assert exc.value.status_code == 401

    def test_wrong_scheme_raises(self):
        creds = HTTPAuthorizationCredentials(scheme="Basic", credentials="abc")
        with pytest.raises(HTTPException) as exc:
            AuthProvider(creds)
        assert exc.value.status_code == 401

    def test_bearer_scheme_accepted(self):
        token = _make_token({"user_id": "u1", "email": "a@b.com"})
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        auth = AuthProvider(creds)
        assert auth.get_token() == token


# ─── AuthProvider.from_token ──────────────────────────────────────────
class TestAuthProviderFromToken:
    def test_from_token_creates_valid_provider(self):
        token = _make_token({"user_id": "u1", "email": "a@b.com"})
        auth = AuthProvider.from_token(token)
        assert auth.get_token() == token


# ─── AuthProvider.get_user ────────────────────────────────────────────
class TestGetUser:
    def test_valid_token_returns_user(self):
        token = _make_token({"user_id": "u1", "email": "a@b.com", "role": "admin", "name": "Alice", "org_id": "org1"})
        user = AuthProvider.from_token(token).get_user()
        assert user.id == "u1"
        assert user.email == "a@b.com"
        assert user.role == "admin"
        assert user.name == "Alice"
        assert user.org_id == "org1"

    def test_missing_user_id_raises(self):
        token = _make_token({"email": "a@b.com"})
        with pytest.raises(HTTPException) as exc:
            AuthProvider.from_token(token).get_user()
        # Inner 401 is caught by the generic except block → re-raised as 500
        assert exc.value.status_code == 500

    def test_missing_email_raises(self):
        token = _make_token({"user_id": "u1"})
        with pytest.raises(HTTPException) as exc:
            AuthProvider.from_token(token).get_user()
        # Inner 401 is caught by the generic except block → re-raised as 500
        assert exc.value.status_code == 500

    def test_user_is_cached(self):
        token = _make_token({"user_id": "u1", "email": "a@b.com"})
        auth = AuthProvider.from_token(token)
        user1 = auth.get_user()
        user2 = auth.get_user()
        assert user1 is user2

    def test_expired_token_raises_401(self):
        token = _make_token({"user_id": "u1", "email": "a@b.com", "exp": int(time.time()) - 10})
        with pytest.raises(HTTPException) as exc:
            AuthProvider.from_token(token).get_user()
        assert exc.value.status_code == 401

    def test_invalid_token_raises_401(self):
        with pytest.raises(HTTPException) as exc:
            AuthProvider.from_token("not.a.real.token").get_user()
        assert exc.value.status_code == 401

    def test_org_id_none_when_absent(self):
        token = _make_token({"user_id": "u1", "email": "a@b.com"})
        user = AuthProvider.from_token(token).get_user()
        assert user.org_id is None

    def test_defaults_role_to_user(self):
        token = _make_token({"user_id": "u1", "email": "a@b.com"})
        user = AuthProvider.from_token(token).get_user()
        assert user.role == "user"


# ─── AuthProvider.verify_token ────────────────────────────────────────
class TestVerifyToken:
    def test_valid_token_returns_payload(self):
        payload = {"user_id": "u1", "email": "a@b.com"}
        token = _make_token(payload)
        result = AuthProvider.from_token(token).verify_token()
        assert result is not None
        assert result["user_id"] == "u1"

    def test_expired_token_returns_none(self):
        token = _make_token({"user_id": "u1", "email": "a@b.com", "exp": int(time.time()) - 10})
        assert AuthProvider.from_token(token).verify_token() is None

    def test_invalid_token_returns_none(self):
        assert AuthProvider.from_token("bad-token").verify_token() is None


# ─── verify_jwt_token (module function) ──────────────────────────────
class TestVerifyJwtToken:
    def test_valid_token(self):
        token = _make_token({"user_id": "u1"})
        result = verify_jwt_token(token)
        assert result is not None
        assert result["user_id"] == "u1"

    def test_expired_returns_none(self):
        token = _make_token({"user_id": "u1", "exp": int(time.time()) - 10})
        assert verify_jwt_token(token) is None

    def test_invalid_returns_none(self):
        assert verify_jwt_token("garbage") is None
