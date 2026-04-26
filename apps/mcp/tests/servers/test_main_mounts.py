from contextlib import asynccontextmanager

import pytest

import main
from models.agent import Agent


def test_main_mounts_all_expected_paths():
    mount_paths = {route.path for route in main.app.routes}

    expected_paths = {
        f"/{Agent.PRODUCT_RESEARCHER.value}",
        f"/{Agent.BUSINESS_ANALYST.value}",
        f"/{Agent.MARKETER.value}",
        f"/{Agent.SEO.value}",
        f"/{Agent.SHOPIFY.value}",
        f"/{Agent.HUBSPOT.value}",
        f"/{Agent.GDRIVE.value}",
        f"/{Agent.FACEBOOK_PAGE.value}",
        f"/{Agent.INSTAGRAM.value}",
        f"/{Agent.EMAIL_MARKETING.value}",
        f"/{Agent.CUSTOMER_SUPPORT.value}",
        f"/{Agent.ANALYTICS.value}",
        f"/{Agent.META_ADS.value}",
        f"/{Agent.GOOGLE_ADS.value}",
        "/custom",
    }

    missing = expected_paths - mount_paths
    assert not missing, f"Missing mount paths: {sorted(missing)}"


@pytest.mark.asyncio
async def test_lifespan_calls_register_workflow_tools(monkeypatch):
    called = False

    async def _register_stub():
        nonlocal called
        called = True

    monkeypatch.setattr(main, "register_workflow_tools", _register_stub)

    async with main.lifespan(main.app):
        pass

    assert called is True


@pytest.mark.asyncio
async def test_lifespan_logs_and_continues_on_registration_error(monkeypatch, caplog):
    async def _register_failing():
        raise RuntimeError("boom")

    monkeypatch.setattr(main, "register_workflow_tools", _register_failing)

    async with main.lifespan(main.app):
        pass

    assert "Error registering workflow tools" in caplog.text
