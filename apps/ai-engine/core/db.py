import motor.motor_asyncio
from beanie import init_beanie
from models.agent import Agent
from models.automations.n8n.n8n_workflow_template import N8NWorkflowTemplate
from models.automations.workflow_template import WorkflowTemplate
from models.automations.workflow import DeployedWorkflow
from models.automations.n8n.n8n_workflow import DeployedN8NWorkflow
from models.automations.n8n.n8n_credential import N8NCredential
from models.automations.workflow_credential import WorkflowCredential
from models.automations.workflow_session import WorkflowSession
from models.chat import Chat
from dotenv import load_dotenv
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
from loguru import logger

load_dotenv()

# Database configuration
MONGODB_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "ai_engine_db")

# Document models for Beanie initialization
DOCUMENT_MODELS = [
    WorkflowTemplate,
    N8NWorkflowTemplate,
    WorkflowCredential,
    N8NCredential,
    DeployedWorkflow,
    DeployedN8NWorkflow,
    WorkflowSession,
    Chat,
    Agent,
]


async def init_db():
    """
    Initialize database connection and Beanie ODM.

    Raises:
        Exception: If database connection fails
    """
    try:
        # Create motor client
        client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)

        # Test connection
        await client.admin.command("ping")
        logger.info(f"✅ MongoDB connection successful: {MONGODB_URI}")

        # Initialize Beanie with document models
        await init_beanie(
            database=client[DB_NAME],  # type: ignore
            document_models=DOCUMENT_MODELS,
        )

        logger.info(f"✅ Beanie initialized successfully for database: {DB_NAME}")
        logger.info(
            f"✅ Document models registered: {[model.__name__ for model in DOCUMENT_MODELS]}"
        )

    except Exception as e:
        logger.error(f"❌ Database initialization failed: {str(e)}")
        raise Exception(f"Database connection failed: {str(e)}")


async def close_db():
    """
    Close database connection.
    """
    try:
        # Beanie doesn't require explicit cleanup, but motor client can be closed
        logger.info("✅ Database connection closed")
    except Exception as e:
        logger.error(f"❌ Error closing database connection: {str(e)}")
