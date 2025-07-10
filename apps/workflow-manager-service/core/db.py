import motor.motor_asyncio
from beanie import init_beanie
from schemas.n8n_workflow import N8NWorkflow

import os



MONGODB_URI = os.getenv('MONGODB_URI')
DB_NAME = os.getenv('DB_NAME', 'ai_engine_db')

async def init_db():
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
    await init_beanie(database=client[DB_NAME], document_models=[N8NWorkflow])