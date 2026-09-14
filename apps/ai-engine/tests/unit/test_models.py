"""
Unit tests for Pydantic models (non-Document models that don't require Beanie).
Also tests for Agent model business logic using direct dict construction
to bypass Beanie's collection-link requirement.
"""

import pytest
from datetime import datetime

# ──────────────────────────────────────────────────────────────────────
# Pure Pydantic models (no Beanie)
# ──────────────────────────────────────────────────────────────────────
from models.user import User
from models.credential import Credential
from models.organization import Organization
from models.asset import Asset, ProcessingStatus

# ──────────────────────────────────────────────────────────────────────
# Enum / non-DB helpers from agent module
# ──────────────────────────────────────────────────────────────────────
from models.agent import (
    PrebuiltAgents,
    AgentType,
    PREBUILT_AGENT_NAMES,
    PREBUILT_AGENT_DESCRIPTIONS,
    PREBUILT_AGENT_TYPES,
    PREBUILT_AGENT_PARENTS,
    PREBUILT_AGENT_PROMPTS,
    _replace_list,
)


# =====================================================================
# User model
# =====================================================================
class TestUserModel:
    def test_user_creation(self):
        user = User(id="u1", email="alice@example.com", name="Alice", role="admin", org_id="org1")
        assert user.id == "u1"
        assert user.email == "alice@example.com"
        assert user.role == "admin"
        assert user.org_id == "org1"

    def test_user_defaults(self):
        user = User(id="u2", email="bob@example.com")
        assert user.name is None
        assert user.role == "user"
        assert user.org_id is None

    def test_user_invalid_email(self):
        with pytest.raises(Exception):
            User(id="u3", email="not-an-email")

    def test_user_invalid_role(self):
        with pytest.raises(Exception):
            User(id="u4", email="x@x.com", role="superadmin")


# =====================================================================
# Organization model
# =====================================================================
class TestOrganizationModel:
    def test_organization_creation(self):
        org = Organization(id="org1", name="Ignitic AI", industry="Technology")
        assert org.id == "org1"
        assert org.name == "Ignitic AI"
        assert org.industry == "Technology"
        assert org.is_active is True

    def test_organization_defaults(self):
        org = Organization(id="org2", name="Minimal Org")
        assert org.description is None
        assert org.website is None
        assert org.is_active is True
        assert org.subscription_plan is None


# =====================================================================
# Credential model
# =====================================================================
class TestCredentialModel:
    def test_credential_creation(self):
        cred = Credential(type="openai", u_id="u1", data={"api_key": "sk-xxx"})
        assert cred.type == "openai"
        assert cred.u_id == "u1"
        assert cred.data == {"api_key": "sk-xxx"}
        assert cred.org_id is None

    def test_credential_with_org(self):
        cred = Credential(type="slack", u_id="u1", org_id="org1", data={"token": "xoxb-xxx"})
        assert cred.org_id == "org1"


# =====================================================================
# Asset model
# =====================================================================
class TestAssetModel:
    def test_asset_creation(self):
        now = datetime.now()
        asset = Asset(
            id="a1",
            user_id="u1",
            category="business_profile",
            title="My Doc",
            storage_provider="cloudinary",
            path="/docs/test.pdf",
            url="https://example.com/test.pdf",
            mime_type="application/pdf",
            file_ext="pdf",
            size_bytes=1024,
            created_by="u1",
            created_at=now,
            updated_at=now,
        )
        assert asset.id == "a1"
        assert asset.mime_type == "application/pdf"
        assert asset.organization_id is None

    def test_processing_status(self):
        ps = ProcessingStatus(asset_id="a1", status="completed", vector_store_ids=["vs1"])
        assert ps.status == "completed"
        assert ps.vector_store_ids == ["vs1"]
        assert ps.error_details is None


# =====================================================================
# Agent enums & lookup tables
# =====================================================================
class TestAgentEnumsAndTables:
    def test_prebuilt_agents_enum_values(self):
        assert PrebuiltAgents.PRODUCT_RESEARCHER.value == "product_researcher"
        assert PrebuiltAgents.MARKETER.value == "marketer"

    def test_agent_type_enum(self):
        assert AgentType.ORCHESTRATOR.value == "orchestrator"
        assert AgentType.WORKER.value == "worker"

    def test_all_prebuilt_agents_have_names(self):
        for agent in PrebuiltAgents:
            assert agent in PREBUILT_AGENT_NAMES
            assert len(PREBUILT_AGENT_NAMES[agent]) > 0

    def test_all_prebuilt_agents_have_descriptions(self):
        for agent in PrebuiltAgents:
            assert agent in PREBUILT_AGENT_DESCRIPTIONS
            assert len(PREBUILT_AGENT_DESCRIPTIONS[agent]) > 0

    def test_all_prebuilt_agents_have_types(self):
        for agent in PrebuiltAgents:
            assert agent in PREBUILT_AGENT_TYPES
            assert PREBUILT_AGENT_TYPES[agent] in (AgentType.ORCHESTRATOR, AgentType.WORKER)

    def test_all_prebuilt_agents_have_parents(self):
        for agent in PrebuiltAgents:
            assert agent in PREBUILT_AGENT_PARENTS
            assert isinstance(PREBUILT_AGENT_PARENTS[agent], str)

    def test_all_prebuilt_agents_have_prompts(self):
        for agent in PrebuiltAgents:
            assert agent in PREBUILT_AGENT_PROMPTS
            assert len(PREBUILT_AGENT_PROMPTS[agent]) > 0

    def test_marketer_is_orchestrator(self):
        assert PREBUILT_AGENT_TYPES[PrebuiltAgents.MARKETER] == AgentType.ORCHESTRATOR

    def test_child_agents_parent_is_marketer(self):
        for child in (
            PrebuiltAgents.FACEBOOK_PAGE,
            PrebuiltAgents.INSTAGRAM,
            PrebuiltAgents.EMAIL_MARKETING,
        ):
            assert PREBUILT_AGENT_PARENTS[child] == PrebuiltAgents.MARKETER.value

    def test_replace_list_reducer(self):
        assert _replace_list(["a", "b"], ["c"]) == ["c"]
        assert _replace_list([], ["x", "y"]) == ["x", "y"]
