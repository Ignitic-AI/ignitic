from fastapi import FastAPI, Depends
from contextlib import asynccontextmanager
from core.db import init_db
from api.n8n.n8n_workflow_template_routes import router as n8n_workflow_templates_router
from api.n8n.n8n_credential_routes import router as n8n_credential_router
from api.n8n.n8n_workflow_routes import router as n8n_workflow_router

from services.workflow_template_service import sync_workflows_from_assets
import os
import uvicorn

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # await sync_workflows_from_assets()
    yield

app = FastAPI(lifespan=lifespan)

# All /api/v1 endpoints now require JWT authentication via get_current_user dependency
app.include_router(n8n_workflow_router, prefix='/api/v1')
app.include_router(n8n_workflow_templates_router, prefix='/api/v1')
app.include_router(n8n_credential_router, prefix='/api/v1')

@app.get("/")
async def read_root():
    return {"message": "Welcome to the Workflow Manager Service"}

if __name__ == "__main__":
    PORT = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=PORT)