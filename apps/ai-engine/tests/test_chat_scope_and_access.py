from types import SimpleNamespace

import pytest

from api.agents import chat_routes
from services.agents.chat_service import ChatService


class _FakeAuth:
    def __init__(self, user_id: str = "user-1", org_id: str | None = "org-1"):
        self._user = SimpleNamespace(id=user_id, org_id=org_id)

    def get_user(self):
        return self._user


@pytest.mark.asyncio
async def test_list_chats_scope_all_uses_all_accessible(monkeypatch):
    calls: list[tuple[str, int, int]] = []

    class _FakeService:
        async def get_all_accessible_chats(self, limit: int, offset: int):
            calls.append(("all", limit, offset))
            return ([], False)

        async def get_org_chats(self, limit: int, offset: int):
            calls.append(("org", limit, offset))
            return ([], False)

        async def get_specific_org_chats(self, org_id: str, limit: int, offset: int):
            calls.append((f"org:{org_id}", limit, offset))
            return ([], False)

        async def get_user_chats(self, limit: int, offset: int):
            calls.append(("personal", limit, offset))
            return ([], False)

    monkeypatch.setattr(chat_routes, "ChatService", lambda auth: _FakeService())

    await chat_routes.list_chats(scope="all", limit=20, offset=5, auth=_FakeAuth())

    assert calls == [("all", 20, 5)]


@pytest.mark.asyncio
async def test_list_chats_is_org_backcompat_uses_org_scope(monkeypatch):
    calls: list[tuple[str, int, int]] = []

    class _FakeService:
        async def get_all_accessible_chats(self, limit: int, offset: int):
            calls.append(("all", limit, offset))
            return ([], False)

        async def get_org_chats(self, limit: int, offset: int):
            calls.append(("org", limit, offset))
            return ([], False)

        async def get_specific_org_chats(self, org_id: str, limit: int, offset: int):
            calls.append((f"org:{org_id}", limit, offset))
            return ([], False)

        async def get_user_chats(self, limit: int, offset: int):
            calls.append(("personal", limit, offset))
            return ([], False)

    monkeypatch.setattr(chat_routes, "ChatService", lambda auth: _FakeService())

    await chat_routes.list_chats(is_org=True, limit=15, offset=0, auth=_FakeAuth())

    assert calls == [("org", 15, 0)]


@pytest.mark.asyncio
async def test_get_chat_if_accessible_respects_personal_and_org_membership(monkeypatch):
    service = ChatService(auth=_FakeAuth(user_id="u-1", org_id="org-1"))

    async def _accessible_org_ids():
        return {"org-1", "org-2"}

    monkeypatch.setattr(service, "_get_accessible_org_ids", _accessible_org_ids)

    async def _get_personal(_chat_id: str):
        return SimpleNamespace(u_id="u-1", org_id=None)

    monkeypatch.setattr(service, "get_chat", _get_personal)
    chat = await service.get_chat_if_accessible("chat-1")
    assert chat is not None

    async def _get_other_user_personal(_chat_id: str):
        return SimpleNamespace(u_id="u-2", org_id=None)

    monkeypatch.setattr(service, "get_chat", _get_other_user_personal)
    chat = await service.get_chat_if_accessible("chat-2")
    assert chat is None

    async def _get_allowed_org(_chat_id: str):
        return SimpleNamespace(u_id="u-2", org_id="org-2")

    monkeypatch.setattr(service, "get_chat", _get_allowed_org)
    chat = await service.get_chat_if_accessible("chat-3")
    assert chat is not None

    async def _get_forbidden_org(_chat_id: str):
        return SimpleNamespace(u_id="u-2", org_id="org-9")

    monkeypatch.setattr(service, "get_chat", _get_forbidden_org)
    chat = await service.get_chat_if_accessible("chat-4")
    assert chat is None
