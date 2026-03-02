import os
import time
from typing import Dict, Any
from langchain_mcp_adapters.client import MultiServerMCPClient
from models.agent import Agent
from models.chat import PrebuiltAgents
from dotenv import load_dotenv
from core.auth import AuthProvider

load_dotenv()

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL")

if not MCP_SERVER_URL:
    raise RuntimeError("MCP_SERVER_URL not set in environment variables")

# Simple in-memory cache for tools
# Structure: { "server_name": {"data": tools_list, "timestamp": expire_time} }
_TOOLS_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL = 300  # Cache duration in seconds (5 minutes)


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
        )

    def get_client(self) -> MultiServerMCPClient:
        return self._client

    async def get_agent_tools(self, agent: Agent):
        server_name = agent.identifier if agent.is_prebuilt() else "custom"
        current_time = time.time()

        # Check cache
        if server_name in _TOOLS_CACHE:
            cache_entry = _TOOLS_CACHE[server_name]
            if current_time < cache_entry["timestamp"]:
                return cache_entry["data"]

        # Fetch fresh data
        tools = await self._client.get_tools(server_name=server_name)

        # Update cache
        _TOOLS_CACHE[server_name] = {
            "data": tools,
            "timestamp": current_time + CACHE_TTL,
        }

        return tools
