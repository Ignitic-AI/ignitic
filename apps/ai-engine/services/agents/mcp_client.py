import os
from langchain_mcp_adapters.client import MultiServerMCPClient
from models.chat import Agent
from dotenv import load_dotenv

load_dotenv()

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL")

if not MCP_SERVER_URL:
    raise RuntimeError("MCP_SERVER_URL not set in environment variables")

client = MultiServerMCPClient(
    connections={
        agent.value: {
            "url": f"{MCP_SERVER_URL}/{agent.value}",
            "transport": "streamable_http"
        }
        for agent in list(Agent)
    }
)


async def get_tools_for_agent(agent: Agent):
    return await client.get_tools(server_name= agent.value)
