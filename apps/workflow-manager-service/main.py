from fastapi import FastAPI
from contextlib import asynccontextmanager
from core.db import init_db
from api.n8n_workflow_routes import router as n8n_workflow_router
from dotenv import load_dotenv
import os, uvicorn

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    yield


app = FastAPI(lifespan=lifespan)

app.include_router(n8n_workflow_router, prefix='/api/v1')

@app.get("/")
async def read_root():
    return {"message": "Welcome to the Workflow Manager Service"}

if __name__ == "__main__":
    PORT = int(os.getenv("PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)