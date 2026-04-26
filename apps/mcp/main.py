import contextlib
import os
import sys
from pathlib import Path

_MCP_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(_MCP_ROOT))

import shopify
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route
from models.agent import Agent
from dotenv import load_dotenv
from servers.product_researcher_mcp import app as product_researcher_mcp
from servers.business_analyst_mcp import app as business_analyst_mcp
from servers.marketer_mcp import app as marketer_mcp
from servers.seo_mcp import app as seo_mcp
from servers.shopify_mcp import app as shopify_mcp
from servers.hubspot_mcp import app as hubspot_mcp
from servers.gdrive_mcp import app as gdrive_mcp
from servers.facebook_page_mcp import app as facebook_page_agent_mcp
from servers.instagram_mcp import app as instagram_mcp
from servers.email_marketing_mcp import app as email_marketing_mcp
from servers.customer_support_mcp import app as customer_support_mcp
from servers.analytics_mcp import app as analytics_mcp
from servers.meta_ads_mcp import app as meta_ads_mcp
from servers.google_ads_mcp import app as google_ads_mcp
from servers.custom_mcp import app as custom_mcp
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


product_researcher_mcp_app = product_researcher_mcp.http_app()
business_analyst_mcp_app = business_analyst_mcp.http_app()
marketer_mcp_app = marketer_mcp.http_app()
seo_mcp_app = seo_mcp.http_app()
shopify_mcp_app = shopify_mcp.http_app()
hubspot_mcp_app = hubspot_mcp.http_app()
gdrive_mcp_app = gdrive_mcp.http_app()
facebook_page_agent_mcp_app = facebook_page_agent_mcp.http_app()
instagram_mcp_app = instagram_mcp.http_app()
email_marketing_mcp_app = email_marketing_mcp.http_app()
customer_support_mcp_app = customer_support_mcp.http_app()
analytics_mcp_app = analytics_mcp.http_app()
meta_ads_mcp_app = meta_ads_mcp.http_app()
google_ads_mcp_app = google_ads_mcp.http_app()
custom_mcp_app = custom_mcp.http_app()

async def health(request: Request):
    return JSONResponse({"status": "ok", "service": "mcp", "version": APP_VERSION})


app = Starlette(
    routes=[
        Route("/health", health),
        Mount(
            f"/{Agent.PRODUCT_RESEARCHER.value}",
            app=product_researcher_mcp_app,
        ),
        Mount(f"/{Agent.BUSINESS_ANALYST.value}", app=business_analyst_mcp_app),
        Mount(f"/{Agent.MARKETER.value}", app=marketer_mcp_app),
        Mount(f"/{Agent.SEO.value}", app=seo_mcp_app),
        Mount(f"/{Agent.SHOPIFY.value}", app=shopify_mcp_app),
        Mount(f"/{Agent.HUBSPOT.value}", app=hubspot_mcp_app),
        Mount(f"/{Agent.GDRIVE.value}", app=gdrive_mcp_app),
        Mount(f"/{Agent.FACEBOOK_PAGE.value}", app=facebook_page_agent_mcp_app),
        Mount(f"/{Agent.INSTAGRAM.value}", app=instagram_mcp_app),
        Mount(f"/{Agent.EMAIL_MARKETING.value}", app=email_marketing_mcp_app),
        Mount(f"/{Agent.CUSTOMER_SUPPORT.value}", app=customer_support_mcp_app),
        Mount(f"/{Agent.ANALYTICS.value}", app=analytics_mcp_app),
        Mount(f"/{Agent.META_ADS.value}", app=meta_ads_mcp_app),
        Mount(f"/{Agent.GOOGLE_ADS.value}", app=google_ads_mcp_app),
        Mount("/custom", app=custom_mcp_app),
    ],
    lifespan=combine_lifespans(
        lifespan,
        product_researcher_mcp_app.lifespan,
        business_analyst_mcp_app.lifespan,
        marketer_mcp_app.lifespan,
        seo_mcp_app.lifespan,
        shopify_mcp_app.lifespan,
        hubspot_mcp_app.lifespan,
        gdrive_mcp_app.lifespan,
        facebook_page_agent_mcp_app.lifespan,
        instagram_mcp_app.lifespan,
        email_marketing_mcp_app.lifespan,
        customer_support_mcp_app.lifespan,
        analytics_mcp_app.lifespan,
        meta_ads_mcp_app.lifespan,
        google_ads_mcp_app.lifespan,
        custom_mcp_app.lifespan,
    ),
)

if __name__ == "__main__":
    import uvicorn

    # Get configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT"))
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
