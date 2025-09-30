from langgraph.store.mongodb import MongoDBStore
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

# Global variable to hold the memory_store instance
mongo_memory_store = None


async def init_mongo_memory_store() -> MongoDBStore:
    """Initialize the MongoDB memory_store within an async context"""
    global mongo_memory_store

    if mongo_memory_store is None:
        if not MONGO_URI or not MONGO_DB_NAME:
            raise ValueError(
                "MONGO_URI and MONGO_DB_NAME environment variables must be set"
            )

        # Create MongoDB client and collection manually
        client = MongoClient(MONGO_URI)
        db = client[MONGO_DB_NAME]
        collection = db["long_term_memory"]

        # Create MongoDB store with the collection
        mongo_memory_store = MongoDBStore(collection=collection)

    return mongo_memory_store


def get_mongo_memory_store() -> MongoDBStore:
    """Get the initialized memory_store instance"""
    if mongo_memory_store is None:
        raise RuntimeError(
            "MongoDB memory_store not initialized. Call init_mongo_checkpointer() first."
        )
    return mongo_memory_store
