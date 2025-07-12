import motor.motor_asyncio
from beanie import init_beanie
from models.n8n_workflow import N8NWorkflowTemplate
import os

MONGODB_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('DB_NAME', 'ai_engine_db')

async def init_db():
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
        await init_beanie(database=client[DB_NAME], document_models=[N8NWorkflowTemplate])
        print(f"[DB] Successfully connected to MongoDB at {MONGODB_URI}, database: {DB_NAME}")
    except Exception as e:
        print(f"[DB] Failed to connect to MongoDB: {e}")
        raise