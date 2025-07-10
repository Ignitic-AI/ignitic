# ai-engine

## Overview
The ai-engine project is part of an agentic automation platform for e-commerce, designed to orchestrate and manage AI agents and their tools, and to integrate with automation platforms like n8n. The system is built using FastAPI, MongoDB (with Beanie ODM), and Pydantic for schema validation.

## Features Implemented

- **Microservices Architecture**: The project is structured for modularity, with a dedicated workflow-manager service for handling n8n workflows.
- **FastAPI Application**: The main API is built with FastAPI, using the new lifespan event handler for startup logic.
- **MongoDB Integration**: Uses Beanie ODM for async, Pydantic-based document modeling and CRUD operations.
- **Environment Configuration**: Loads environment variables (e.g., MongoDB URI, port) from a `.env` file using `python-dotenv`.
- **Workflow Models**: Pydantic and Beanie models for workflows, workflow inputs/outputs, and n8n workflow data are defined in `schemas/`.
- **n8n Workflow Import**: API endpoint to import n8n workflows, with validation to ensure only workflows starting with a webhook trigger are accepted.
- **API Routing**: All API endpoints are prefixed with `/api/v1` for versioning and organization.
- **Service Layer**: Business logic for CRUD operations is separated into a `services/` directory.
- **Validation**: Custom Pydantic validators ensure only valid n8n workflows are accepted (e.g., webhook trigger enforcement).

## Project Structure

```
workflow-manager-service/
├── main.py                  # FastAPI app entrypoint
├── core/
│   └── db.py                # Database initialization and Beanie setup
├── schemas/
│   ├── workflow.py          # Workflow, input/output, and base models
│   └── n8n_workflow.py      # n8n workflow and node models
├── services/
│   └── n8n_workflow_service.py   # CRUD logic for n8n workflows
├── api/
│   └── n8n_workflow_routes.py    # FastAPI routes for n8n workflows
├── .env                     # Environment variables (not committed)
└── ...
```

## How to Run

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Set up your `.env` file with at least:
   ```
   MONGODB_URI=mongodb://localhost:27017
   DB_NAME=n8n_workflows
   PORT=8001
   ```
3. Start the app:
   ```bash
   python main.py
   ```
   Or with Uvicorn:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8001 --reload
   ```

## API Example

- **Import n8n Workflow**
  - Endpoint: `POST /api/v1/workflow/n8n/import`
  - Body: (see `schemas/n8n_workflow.py` for structure)

## Notes
- Only workflows starting with a webhook trigger (`n8n-nodes-base.webhook`) are accepted.
- All database models use Beanie and are stored in the `n8n_workflows` collection by default.
- The project uses async/await throughout for high performance.

---
This README will be updated as more features are added.
