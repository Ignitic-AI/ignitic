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


async def isCheckpointerLastMessageEqualTo(thread_id: str, message: str) -> bool:
    """Check if the last message in the checkpoint for the given thread_id matches the provided message."""
    if mongo_checkpointer is None:
        raise RuntimeError(
            "MongoDB checkpointer not initialized. Call init_mongo_checkpointer() first."
        )

    # Fetch the latest checkpoint for the given thread_id
    latest_checkpoint = await mongo_checkpointer.aget(
        config={"configurable": {"thread_id": thread_id}}
    )

    if (
        latest_checkpoint
        and latest_checkpoint["channel_values"]["messages"]
    ):
        last_message = latest_checkpoint["channel_values"]["messages"][-1]
        if hasattr(last_message, "content"):
            last_message_content = last_message.content
        else:
            last_message_content = last_message['content']

        return last_message_content == message

    return False
