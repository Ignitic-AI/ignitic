from langgraph.checkpoint.mongodb import MongoDBSaver
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "ai_engine_db")

# Create MongoDB client and checkpointer (using synchronous client for checkpointer)
mongo_client = MongoClient(MONGO_URI)
mongo_checkpointer = MongoDBSaver(
    client=mongo_client,
    db_name=MONGO_DB_NAME,
    checkpoint_collection_name="chat_checkpoints",
)
