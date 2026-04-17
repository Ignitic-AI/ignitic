import os
import time
from typing import Dict, Any
from langchain_mcp_adapters.client import MultiServerMCPClient
from loguru import logger
from models.agent import Agent
from models.agent import PrebuiltAgents
from dotenv import load_dotenv
from core.auth import AuthProvider

load_dotenv()

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL")

if not MCP_SERVER_URL:
    raise RuntimeError("MCP_SERVER_URL not set in environment variables")

# Simple in-memory cache for tools
# Structure: { "server_name": {"data": tools_list, "timestamp": expire_time} }
_TOOLS_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL = 600  # Cache duration in seconds (10 minutes)


class MCPClientService:
    def __init__(self, auth: AuthProvider) -> None:
        self._auth = auth

        self._client = MultiServerMCPClient(
            connections={
                agent.value: {
                    "url": f"{MCP_SERVER_URL}/{agent.value}",
                    "transport": "streamable_http",
                    "headers": {
                        "Authorization": f"Bearer {self._auth.get_token()}",
                    },
                }
                for agent in list(PrebuiltAgents)
            }
            | {
                "custom": {
                    "url": f"{MCP_SERVER_URL}/custom",
                    "transport": "streamable_http",
                    "headers": {
                        "Authorization": f"Bearer {self._auth.get_token()}",
                    },
                }
            } # type: ignore
        )

    def get_client(self) -> MultiServerMCPClient:
        return self._client

    @staticmethod
    def _filter_tools_for_agent(agent: Agent, tools):
        """
        Apply per-agent tool allowlist for custom agents.
        Never mutates cached tool lists.
        """
        try:
            allowlist = getattr(agent, "tool_names", None) or []
            if agent.is_prebuilt() or not allowlist:
                return tools
            allow = set(allowlist)
            return [t for t in (tools or []) if getattr(t, "name", None) in allow]
        except Exception:
            return tools

    async def get_agent_tools(self, agent: Agent):
        server_name = agent.identifier if agent.is_prebuilt() else "custom"
        current_time = time.time()

        # Check cache
        if server_name in _TOOLS_CACHE:
            cache_entry = _TOOLS_CACHE[server_name]
            if current_time < cache_entry["timestamp"]:
                # logger.debug(f"🔍 Found cached tools for server '{server_name}'")
                cached = cache_entry["data"]
                # Always apply per-agent allowlist even on cache hits
                return self._filter_tools_for_agent(
                    agent, list(cached) if cached else cached
                )

        logger.debug(f"📡 Fetching tools from server '{server_name}'")
        # Fetch fresh data
        tools = await self._client.get_tools(server_name=server_name)

        # Update cache
        _TOOLS_CACHE[server_name] = {
            "data": tools,
            "timestamp": current_time + CACHE_TTL,
        }

        return self._filter_tools_for_agent(agent, tools)
