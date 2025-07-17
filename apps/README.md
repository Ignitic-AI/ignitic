# ai-engine

## Overview
The ai-engine project is part of an agentic automation platform for e-commerce, designed to orchestrate and manage AI agents and their tools, and to integrate with automation platforms like n8n. The system is built using FastAPI, MongoDB (with Beanie ODM), and Pydantic for schema validation.

## Features Implemented

- **Microservices Architecture**: The project is structured for modularity, with a dedicated workflow-manager service for handling n8n workflows.
- **FastAPI Application**: The main API is built with FastAPI, using the new lifespan event handler for startup logic.
- **MongoDB Integration**: Uses Beanie ODM for async, Pydantic-based document modeling and CRUD operations.
- **Environment Configuration**: Loads environment variables (e.g., MongoDB URI, port) from a `.env` file using `python-dotenv`.
- **Workflow Models**: Pydantic and Beanie models for workflows, workflow inputs/outputs, and n8n workflow data are defined in `models/`.
- **Workflow Template Syncing**: On server startup, all workflow templates in `assets/workflow_templates/n8n/` are automatically synced with the MongoDB database.
- **Timestamp Management**: Workflow templates include `created_at` and `updated_at` fields, which are set and updated during sync and CRUD operations.
- **n8n Workflow Import**: API endpoint to import n8n workflows, with validation to ensure only workflows starting with a webhook trigger are accepted.
- **API Routing**: All API endpoints are prefixed with `/api/v1` for versioning and organization.
- **Service Layer**: Business logic for CRUD operations and workflow syncing is separated into a `services/` directory.
- **Validation**: Custom Pydantic validators ensure only valid n8n workflows are accepted (e.g., webhook trigger enforcement).
- **Database Connection Logging**: Logs to the terminal whether the MongoDB connection and Beanie initialization succeeded or failed.

## Project Structure


```
ai-engine/
├── main.py                          # FastAPI app entrypoint
├── core/
│   └── db.py                        # Database initialization and Beanie setup
├── models/
│   ├── workflow.py                  # Workflow, input/output, and base models
│   ├── automations/
│   │   └── n8n/
│   │       ├── n8n_workflow.py      # n8n workflow and node models
│   │       ├── n8n_credential.py    # n8n credential models
│   │       └── n8n_workflow_template.py # n8n workflow template models
├── services/
│   ├── n8n/
│   │   ├── n8n_workflow_service.py  # CRUD logic and sync for n8n workflows
│   │   ├── n8n_credential_service.py# Credential encryption/registration logic
├── api/
│   ├── n8n/
│   │   ├── n8n_workflow_routes.py   # FastAPI routes for n8n workflows
│   │   ├── n8n_credential_routes.py # FastAPI routes for n8n credentials
│   │   └── n8n_workflow_template_routes.py # FastAPI routes for workflow templates
├── assets/
│   └── workflow_templates/
│       └── n8n/                     # JSON workflow templates
├── .env                             # Environment variables (not committed)
└── README.md                        # Project documentation
```

## How to Run

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Set up your `.env` file with at least:
   ```
   MONGODB_URI=mongodb://localhost:27017
   DB_NAME=ai_engine_db
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

## API Endpoints

### Workflow Template Endpoints
- **Import n8n Workflow Template**
  - `POST /api/v1/workflow-template/n8n/import`
  - Body: See `models/n8n_workflow.py` for structure
- **Create Workflow Template**
  - `POST /api/v1/workflow-template/n8n/`
  - Body: N8NWorkflowTemplate JSON
  - Returns: Inserted ID and the created template
- **Get All Workflow Templates**
  - `GET /api/v1/workflow-template/n8n/?limit=10`
  - Query param: `limit` (optional, default 10)
  - Returns: List of workflow templates
- **Get Workflow Template by ID**
  - `GET /api/v1/workflow-template/n8n/{id}`
  - Returns: Workflow template with the given ID
- **Delete Workflow Template by ID**
  - `DELETE /api/v1/workflow-template/n8n/{id}`
  - Returns: Success message if deleted

### Workflow Deployment & Management Endpoints

**Get All Deployed Workflows**
  - `GET /api/v1/workflow/n8n/`
  - Query param: `limit` (optional, default 100)
  - Returns: List of deployed workflows for the authenticated user or organization
**Get Deployed Workflow by ID**
  - `GET /api/v1/workflow/n8n/{id}`
  - Returns: Deployed workflow with the given ID or ignitic_identifier
**Deploy Workflow from Template**
  - `POST /api/v1/workflow/n8n/deploy/template-{workflow_template_id}`
  - Deploys a workflow from a template for the current user/org.
  - Returns: Deployment status and deployed workflow info
**Activate Deployed Workflow**
  - `POST /api/v1/workflow/n8n/activate/{workflow_id}`
  - Activates a deployed workflow by its ID or ignitic_identifier
  - Returns: Activation status and workflow info
**Delete Deployed Workflow**
  - `DELETE /api/v1/workflow/n8n/{workflow_id}`
  - Deletes a deployed workflow by its ID or ignitic_identifier
  - Returns: Success message if deleted

### Credential Management Endpoints

**Get All SMTP Credentials**
  - `GET /api/v1/credential/n8n/`
  - Query param: `limit` (optional, default 100)
  - Returns: List of SMTP credentials for the authenticated user or organization
**Get SMTP Credential by ID**
  - `GET /api/v1/credential/n8n/{id}`
  - Returns: SMTP credential with the given ID
**Create SMTP Credential**
  - `POST /api/v1/credential/n8n/smtp`
  - Body: N8NSMTPCredential JSON
  - Returns: Created credential info
**Delete SMTP Credential**
  - `DELETE /api/v1/credential/n8n/{credential_id}`
  - Deletes an SMTP credential by its ID
  - Returns: Success message if deleted

## Notes
- Only workflows starting with a webhook trigger (`n8n-nodes-base.webhook`) are accepted.
- All database models use Beanie and are stored in the `n8n_workflow_templates` collection by default.
- The project uses async/await throughout for high performance.
- On startup, workflow templates in `assets/workflow_templates/n8n/` are automatically synced to the database.
- Database connection status is logged to the terminal.

---
This README will be updated as more features are added.
