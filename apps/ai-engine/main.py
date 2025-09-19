from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from core.db import init_db, close_db
from api.n8n.n8n_workflow_template_routes import router as n8n_workflow_templates_router
from api.workflow_template_routes import router as workflow_templates_router
from api.n8n.n8n_credential_routes import router as n8n_credential_router
from api.credential_routes import router as credential_router
from api.n8n.n8n_workflow_routes import router as n8n_workflow_router
from api.workflow_routes import router as workflow_router
from api.workflow_session_routes import router as workflow_session_router
from api.agents.chat_routes import router as chat_router
from services.agents.checkpointers import init_mongo_checkpointer
import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Application configuration
APP_NAME = "AI Engine"
APP_VERSION = "1.0.0"
APP_DESCRIPTION = "AI Engine for managing N8N workflows and automation templates"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Handles startup and shutdown events for the FastAPI application.
    """
    # Startup
    logger.info("🚀 Starting AI Engine...")
    try:
        await init_db()
        logger.info("✅ Database initialized successfully")

        # Initialize MongoDB checkpointer
        await init_mongo_checkpointer()
        logger.info("✅ MongoDB checkpointer initialized successfully")

        # Uncomment to sync workflows from assets
        # await sync_workflows_from_assets()
        logger.info("✅ Workflows synced from assets")

    except Exception as e:
        logger.error(f"❌ Failed to initialize application: {str(e)}")
        raise

    logger.info(f"✅ {APP_NAME} v{APP_VERSION} started successfully")

    yield

    # Shutdown
    logger.info("🛑 Shutting down AI Engine...")
    try:
        await close_db()
        logger.info("✅ Database connection closed")
    except Exception as e:
        logger.error(f"❌ Error during shutdown: {str(e)}")

    logger.info("✅ AI Engine shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=APP_NAME,
    description=APP_DESCRIPTION,
    version=APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(
    n8n_workflow_router,
    prefix="/api/v1",
    tags=["N8N Workflows"],
    responses={401: {"description": "Unauthorized"}},
)

app.include_router(
    workflow_router,
    prefix="/api/v1",
    tags=["Workflows"],
    responses={401: {"description": "Unauthorized"}},
)

app.include_router(
    workflow_session_router,
    prefix="/api/v1",
    tags=["Workflow Sessions"],
    responses={401: {"description": "Unauthorized"}},
)

app.include_router(
    workflow_templates_router,
    prefix="/api/v1",
    tags=["Workflow Templates"],
    responses={401: {"description": "Unauthorized"}},
)

app.include_router(
    n8n_workflow_templates_router,
    prefix="/api/v1",
    tags=["N8N Workflow Templates"],
    responses={401: {"description": "Unauthorized"}},
)

app.include_router(
    n8n_credential_router,
    prefix="/api/v1",
    tags=["N8N Credentials"],
    responses={401: {"description": "Unauthorized"}},
)

app.include_router(
    credential_router,
    prefix="/api/v1",
    tags=["Credentials"],
    responses={401: {"description": "Unauthorized"}},
)

app.include_router(
    chat_router,
    prefix="/api/v1",
    tags=["Chat Agents"],
    responses={401: {"description": "Unauthorized"}},
)


@app.get("/", tags=["Health"])
async def read_root():
    """
    Root endpoint for health check and API information.

    Returns:
        dict: API information and status
    """
    return {
        "message": f"Welcome to {APP_NAME}",
        "version": APP_VERSION,
        "status": "healthy",
        "docs": "/docs",
        "redoc": "/redoc",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint.

    Returns:
        dict: Health status information
    """
    return {"status": "healthy", "service": APP_NAME, "version": APP_VERSION}


# @app.exception_handler(HTTPException)
# async def http_exception_handler(request, exc):
#     """
#     Global HTTP exception handler.

#     Args:
#         request: FastAPI request object
#         exc: HTTPException instance

#     Returns:
#         dict: Standardized error response
#     """
#     logger.error(f"HTTP Exception: {exc.status_code} - {exc.detail}")
#     return {
#         "error": exc.detail,
#         "status_code": exc.status_code,
#         "path": request.url.path,
#     }


if __name__ == "__main__":
    import uvicorn

    # Get configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8010))
    debug = os.getenv("DEBUG", "false").lower() == "true"

    logger.info(f"Starting server on {host}:{port}")

    uvicorn.run("main:app", host=host, port=port, reload=debug, log_level="info", access_log=False, server_header=False, loop='asyncio')
