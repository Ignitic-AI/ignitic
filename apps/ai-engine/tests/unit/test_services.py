"""
Unit tests for services/credential_service.py – CredentialService.adapt_from_backend.
"""

import pytest
from datetime import datetime, timezone
from services.credential_service import CredentialService


class TestAdaptFromBackend:
    def test_single_secret(self):
        data = {
            "secrets": [
                {
                    "app": "openai",
                    "name": "api_key",
                    "value": "sk-test-123",
                    "created_by": "u1",
                    "updated_at": "2025-06-01T12:00:00Z",
                }
            ]
        }
        cred = CredentialService.adapt_from_backend(data)
        assert cred.type == "openai"
        assert cred.u_id == "u1"
        assert cred.data == {"api_key": "sk-test-123"}

    def test_multiple_secrets(self):
        data = {
            "secrets": [
                {"app": "stripe", "name": "publishable_key", "value": "pk_xxx", "created_by": "u1", "updated_at": "2025-01-01T00:00:00Z"},
                {"app": "stripe", "name": "secret_key", "value": "sk_xxx", "created_by": "u1", "updated_at": "2025-06-01T00:00:00Z"},
            ]
        }
        cred = CredentialService.adapt_from_backend(data)
        assert cred.data["publishable_key"] == "pk_xxx"
        assert cred.data["secret_key"] == "sk_xxx"
        # Should pick the latest updated_at
        assert cred.updatedAt.year == 2025
        assert cred.updatedAt.month == 6

    def test_json_value_parsed(self):
        import json
        data = {
            "secrets": [
                {
                    "app": "google",
                    "name": "oauth_tokens",
                    "value": json.dumps({"access_token": "at", "refresh_token": "rt"}),
                    "created_by": "u1",
                }
            ]
        }
        cred = CredentialService.adapt_from_backend(data)
        assert cred.data["oauth_tokens"]["access_token"] == "at"

    def test_missing_secrets_raises(self):
        with pytest.raises(ValueError, match="secrets"):
            CredentialService.adapt_from_backend({})

    def test_empty_secrets_raises(self):
        with pytest.raises(ValueError, match="secrets"):
            CredentialService.adapt_from_backend({"secrets": []})

    def test_invalid_secrets_type_raises(self):
        with pytest.raises(ValueError, match="secrets"):
            CredentialService.adapt_from_backend({"secrets": "not-a-list"})

    def test_no_timestamp_defaults_to_now(self):
        data = {
            "secrets": [
                {"app": "slack", "name": "token", "value": "xoxb-xxx", "created_by": "u1"}
            ]
        }
        cred = CredentialService.adapt_from_backend(data)
        # updatedAt should be roughly now
        assert (datetime.now() - cred.updatedAt).total_seconds() < 5


class TestAdaptFromBackendOrganization:
    """Tests for the OrganizationService.adapt_from_backend static method."""

    def test_basic_org(self):
        from services.organization_service import OrganizationService

        data = {
            "organization": {
                "id": "org1",
                "name": "Test Corp",
                "industry": "Tech",
                "is_active": True,
            },
            "user_role": "admin",
        }
        org = OrganizationService.adapt_from_backend(data)
        assert org.id == "org1"
        assert org.name == "Test Corp"
        assert org.user_role == "admin"
        assert org.is_active is True

    def test_flat_dict_fallback(self):
        from services.organization_service import OrganizationService

        data = {"id": "org2", "name": "Flat Org"}
        org = OrganizationService.adapt_from_backend(data)
        assert org.id == "org2"
        assert org.name == "Flat Org"
        assert org.user_role is None
