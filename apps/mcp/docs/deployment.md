# Deployment Guide
# Ignitic AI MCP Server

**Version:** 1.0  
**Status:** Active  
**Last Updated:** 2026-05-03

---

## Overview

The MCP Server is deployed as a Docker container on **AWS ECS** (Elastic Container Service). Container images are stored in **Amazon ECR** (Elastic Container Registry) and automatically built and pushed by GitHub Actions on every merge to the `prod` branch.

---

## Environment Variables

Copy `env.example` to `.env` and populate the required values before running locally or configuring ECS task definitions.

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | HTTP port the server listens on | `8011` |
| `JWT_SECRET` | Shared secret for JWT verification (must match the Backend API and AI Engine) | *(min 32 chars)* |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `AI_ENGINE_BASE_URL` | Internal base URL of the AI Engine service | `http://ai-engine:8010` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `DEBUG` | `false` | Enable uvicorn auto-reload and verbose logging |

### Third-Party Credentials

Third-party API credentials (Shopify tokens, HubSpot keys, Google credentials, etc.) are **not** stored as environment variables on the MCP Server. They are retrieved at tool invocation time from the AI Engine on behalf of the authenticated user.

The only exception is for credentials that must be available at the process level (e.g., Google service account key files for Drive/Ads). These should be mounted as secrets in the ECS task definition.

---

## Local Development

### Prerequisites

- Python 3.12+
- `uv` package manager (`pip install uv`)
- Docker (optional, for containerised testing)
- A running AI Engine instance (or mock)

### Steps

```bash
cd mcp/

# Install dependencies
uv sync

# Configure environment
cp env.example .env
# Edit .env — set JWT_SECRET, JWT_ALGORITHM, AI_ENGINE_BASE_URL, PORT

# Start the server
uv run python main.py
```

The server starts on `http://0.0.0.0:8011` with all 15 MCP servers mounted.

Available endpoints once running:
- Health check: `http://localhost:8011/health`
- Product Researcher: `http://localhost:8011/product_researcher`
- Shopify Agent: `http://localhost:8011/shopify_agent`
- HubSpot Agent: `http://localhost:8011/hubspot_agent`
- *(… and all other agents — see [API Reference](api-reference.md))*

### Stopping the Server

```bash
# Linux/macOS
./stop-server.sh

# Windows PowerShell
.\stop-server.ps1

# Windows Batch
.\stop-server.bat
```

---

## Docker Build

The Dockerfile is in `mcp/Dockerfile` and the build context is the **monorepo root** (because the MCP container also includes a copy of the `ai-engine/` directory for shared models).

### Build Image

```bash
# From the repository root
docker build \
  --platform linux/amd64 \
  --file mcp/Dockerfile \
  -t mcp-server:latest .
```

### Run Container

```bash
docker run -d \
  --name mcp-server \
  -p 8011:8011 \
  --env-file mcp/.env \
  mcp-server:latest
```

### Dockerfile Notes

| Detail | Value |
|--------|-------|
| Base image | `python:3.12-slim` |
| Working directory | `/workspace/mcp` |
| Port | `8011` |
| Health check | `GET http://localhost:8011/health` every 15 s |
| Startup command | `uv run python main.py` |
| Install command | `uv sync --frozen --no-dev --no-install-project` |

The Dockerfile copies both `mcp/` and `ai-engine/` directories into the image. The `ai-engine/` directory provides shared models (`Credential`, `ToolExecution`, `WorkflowTemplate`, etc.) that the MCP Server imports at runtime.

```dockerfile
COPY mcp/pyproject.toml mcp/uv.lock ./
RUN RUSTFLAGS="--cfg reqwest_unstable" uv sync --frozen --no-dev --no-install-project

COPY mcp/ /workspace/mcp/
COPY ai-engine/ /workspace/ai-engine/
```

---

## AWS Deployment

### Infrastructure Overview

```
GitHub (prod branch push)
         │
         ▼
GitHub Actions
         │
    ┌────┴────┐
    │  Build  │  docker build --platform linux/amd64
    │  & Push │  docker push → Amazon ECR
    └────┬────┘
         │
         ▼
Amazon ECR
(Container Registry)
         │
         ▼
AWS ECS (Elastic Container Service)
         │
    ┌────┴────────────────────────┐
    │  ECS Service (mcp)          │
    │  ┌──────────────────────┐   │
    │  │  ECS Task (Fargate)  │   │
    │  │  Container: mcp:8011 │   │
    │  └──────────────────────┘   │
    └─────────────────────────────┘
         │
         ▼
    VPC (internal access only)
    ← AI Engine calls MCP Server via private IP
```

The MCP Server is accessible **only within the VPC**. It is not exposed to the public internet; only the AI Engine communicates with it over the internal network.

### Required AWS Resources

| Resource | Description |
|----------|-------------|
| ECR Repository | Stores the MCP Docker image (`ECR_REPOSITORY_MCP` secret) |
| ECS Cluster | Shared cluster for ai-engine and mcp services (`ECS_CLUSTER` secret) |
| ECS Service | Runs the MCP task definition (`ECS_SERVICE_MCP` secret) |
| Task Definition | Specifies container image, CPU/memory, port mappings, env vars, secrets |
| IAM Task Role | Execution role with ECR pull and Secrets Manager read permissions |
| Security Group | Allow inbound TCP 8011 from the AI Engine's security group |

### ECS Task Definition (key settings)

```json
{
  "family": "mcp-server",
  "containerDefinitions": [{
    "name": "mcp-server",
    "image": "<account>.dkr.ecr.<region>.amazonaws.com/<ECR_REPOSITORY_MCP>:latest",
    "portMappings": [{ "containerPort": 8011 }],
    "environment": [
      { "name": "PORT", "value": "8011" },
      { "name": "HOST", "value": "0.0.0.0" }
    ],
    "secrets": [
      { "name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:...:JWT_SECRET" },
      { "name": "JWT_ALGORITHM", "valueFrom": "arn:aws:secretsmanager:...:JWT_ALGORITHM" },
      { "name": "AI_ENGINE_BASE_URL", "valueFrom": "arn:aws:secretsmanager:...:AI_ENGINE_BASE_URL" }
    ],
    "healthCheck": {
      "command": ["CMD-SHELL", "curl -f http://localhost:8011/health || exit 1"],
      "interval": 15,
      "timeout": 10,
      "retries": 3,
      "startPeriod": 30
    }
  }],
  "cpu": "512",
  "memory": "1024"
}
```

> **Security note:** Store all sensitive values (JWT secret, API keys) in **AWS Secrets Manager** and reference them via the `secrets` array in the task definition. Never put secrets in the `environment` array.

---

## CI/CD Pipeline

### Trigger

The deployment pipeline is defined in `.github/workflows/deploy.yml` and runs automatically on every push to the `prod` branch.

### Pipeline Steps

```
Push to prod branch
       │
       ▼
1. actions/checkout@v4
       │
       ▼
2. aws-actions/configure-aws-credentials@v4
   (uses AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION secrets)
       │
       ▼
3. aws-actions/amazon-ecr-login@v2
       │
       ▼
4. docker/setup-buildx-action@v3
       │
       ▼
5. docker build \
     --platform linux/amd64 \
     --file mcp/Dockerfile \
     --cache-from $ECR_REGISTRY/$ECR_REPOSITORY_MCP:latest \
     --build-arg BUILDKIT_INLINE_CACHE=1 \
     -t $ECR_REGISTRY/$ECR_REPOSITORY_MCP:latest .
       │
       ▼
6. docker push $ECR_REGISTRY/$ECR_REPOSITORY_MCP:latest
       │
       ▼
7. aws ecs update-service \
     --cluster $ECS_CLUSTER \
     --service $ECS_SERVICE_MCP \
     --force-new-deployment
       └─ ECS performs rolling replacement of running tasks
```

The MCP and AI Engine deployments run as **parallel jobs** in the same workflow — deploying both services simultaneously when the `prod` branch is updated.

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user/role key with ECR push and ECS update permissions |
| `AWS_SECRET_ACCESS_KEY` | Corresponding secret access key |
| `AWS_REGION` | AWS region (e.g., `us-east-1`) |
| `ECR_REPOSITORY_MCP` | ECR repository name for the MCP Server image |
| `ECS_CLUSTER` | ECS cluster name |
| `ECS_SERVICE_MCP` | ECS service name for the MCP Server |

---

## Rolling Deployment Strategy

ECS performs a **rolling update** by default:

1. A new task starts and the health check (`GET /health`) must pass within the 30-second `startPeriod`.
2. Once healthy, ECS drains the old task: it stops accepting new connections.
3. The MCP Server has `timeout_graceful_shutdown=5` — in-flight requests get 5 seconds to complete.
4. The old task terminates.

### Rollback

To roll back to the previous deployment:

```bash
# List recent task definition revisions
aws ecs describe-task-definition --task-definition mcp-server

# Force re-deploy with a specific revision
aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service $ECS_SERVICE_MCP \
  --task-definition mcp-server:<previous_revision>
```

---

## Monitoring and Observability

| Tool | Configuration | Purpose |
|------|--------------|---------|
| AWS CloudWatch Logs | ECS awslogs log driver | Container stdout/stderr captured automatically |
| ECS Health Checks | `GET /health` | Container health; unhealthy containers are replaced |
| Tool Execution Logs | AI Engine MongoDB | All tool invocations logged via `ExecutionLoggingMiddleware` |

### Log Format

The MCP Server uses Python's standard `logging` module:

```
%(asctime)s - %(name)s - %(levelname)s - %(message)s
```

Log levels:
- `INFO` — server startup, tool execution start/end
- `ERROR` — tool failures, logging backend errors
- `DEBUG` — detailed middleware trace (requires `DEBUG=true`)

### Key Log Messages

| Message | Level | Meaning |
|---------|-------|---------|
| `Starting server on {host}:{port}` | INFO | Server startup |
| `Registering workflow tools...` | INFO | Dynamic tool registration beginning |
| `Registered {N} workflow tools.` | INFO | Startup complete |
| `Starting tool execution: {name}` | INFO | Tool call received |
| `Tool execution succeeded: {name}` | INFO | Tool completed successfully |
| `Tool execution failed: {name}` | ERROR | Tool raised an exception |
| `Error registering workflow tools: {e}` | ERROR | Startup workflow registration failed (non-fatal) |
