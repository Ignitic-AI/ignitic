import os
from langchain_mcp_adapters.client import MultiServerMCPClient
from models.chat import Agent
from dotenv import load_dotenv
from core.auth import AuthProvider

load_dotenv()

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL")

if not MCP_SERVER_URL:
    raise RuntimeError("MCP_SERVER_URL not set in environment variables")


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
                for agent in list(Agent)
            }
        )

    def get_client(self) -> MultiServerMCPClient:
        return self._client

    async def get_agent_tools(self, agent: Agent):
        return await self._client.get_tools(server_name=agent.value)
