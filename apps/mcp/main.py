import contextlib
import os
import shopify
from starlette.applications import Starlette
from starlette.routing import Mount
from models.agent import Agent
from dotenv import load_dotenv
from servers.product_researcher_mcp import app as product_researcher_mcp
from servers.marketer_mcp import app as marketer_mcp
from servers.seo_mcp import app as seo_mcp
from servers.shopify_mcp import app as shopify_mcp
from servers.tools.workflow_tools import register_workflow_tools
import logging

from utils.lifespan import combine_lifespans

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
        try:
            await register_workflow_tools()
        except Exception as e:
            logger.error(f"Error registering workflow tools: {e}")
        yield

product_researcher_mcp_app = product_researcher_mcp.streamable_http_app()
marketer_mcp_app = marketer_mcp.streamable_http_app()
seo_mcp_app = seo_mcp.streamable_http_app()
shopify_mcp_app = shopify_mcp.streamable_http_app()

app = Starlette(
    routes=[
        Mount(
            f"/{Agent.PRODUCT_RESEARCHER.value}",
            app=product_researcher_mcp_app,
        ),
        Mount(f"/{Agent.MARKETER.value}", app=marketer_mcp_app),
        Mount(f"/{Agent.SEO.value}", app=seo_mcp_app),
        Mount(f"/{Agent.SHOPIFY.value}", app=shopify_mcp_app),
    ],
    lifespan=combine_lifespans(
        lifespan,
        product_researcher_mcp_app.lifespan,
        marketer_mcp_app.lifespan,
        seo_mcp_app.lifespan,
        shopify_mcp_app.lifespan,
    ),
)

if __name__ == "__main__":
    import uvicorn

    # Get configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8011))
    debug = os.getenv("DEBUG", "false").lower() == "true"

    logger.info(f"Starting server on {host}:{port}")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info",
        timeout_graceful_shutdown=5,  # Give 5 seconds for graceful shutdown
        timeout_keep_alive=5,
    )
