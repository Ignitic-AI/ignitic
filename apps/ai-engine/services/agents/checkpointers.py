from langgraph.checkpoint.mongodb import AsyncMongoDBSaver
from pymongo import AsyncMongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

# Global variable to hold the checkpointer instance
mongo_checkpointer = None


async def init_mongo_checkpointer():
    """Initialize the MongoDB checkpointer within an async context"""
    global mongo_checkpointer

    if mongo_checkpointer is None:
        if not MONGO_URI or not MONGO_DB_NAME:
            raise ValueError(
                "MONGO_URI and MONGO_DB_NAME environment variables must be set"
            )

        # Create MongoDB client and checkpointer
        mongo_client = AsyncMongoClient(MONGO_URI)
        mongo_checkpointer = AsyncMongoDBSaver(
            client=mongo_client,
            db_name=MONGO_DB_NAME,
            checkpoint_collection_name="chat_checkpoints",
        )

    return mongo_checkpointer


def get_mongo_checkpointer():
    """Get the initialized checkpointer instance"""
    if mongo_checkpointer is None:
        raise RuntimeError(
            "MongoDB checkpointer not initialized. Call init_mongo_checkpointer() first."
        )
    return mongo_checkpointer
