import contextlib
import os
from starlette.applications import Starlette
from starlette.routing import Mount
from models.agent import Agent
from dotenv import load_dotenv
from servers.product_researcher_mcp import app as product_researcher_mcp
from servers.marketer_mcp import app as marketer_mcp
import logging

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Application configuration
APP_NAME = "MCP Server"
APP_VERSION = "1.0.0"
APP_DESCRIPTION = "Multi-Server MCP for AI Engine"

@contextlib.asynccontextmanager
async def lifespan(app: Starlette):
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(product_researcher_mcp.session_manager.run())
        await stack.enter_async_context(marketer_mcp.session_manager.run())
        yield


app = Starlette(
    routes=[
        Mount(
            f"/{Agent.PRODUCT_RESEARCHER.value}",
            app=product_researcher_mcp.streamable_http_app(),
        ),
        Mount(f"/{Agent.MARKETER.value}", app=marketer_mcp.streamable_http_app()),
    ],
    lifespan=lifespan,
)

if __name__ == "__main__":
    import uvicorn

    # Get configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8080))
    debug = os.getenv("DEBUG", "false").lower() == "true"

    logger.info(f"Starting server on {host}:{port}")

    uvicorn.run("main:app", host=host, port=port, reload=debug, log_level="info")
