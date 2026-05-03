# Deployment Guide
# Ignitic AI Engine

---

## Overview

The AI Engine is deployed as a Docker container on **AWS ECS** (Elastic Container Service). Container images are stored in **Amazon ECR** (Elastic Container Registry) and automatically built and pushed by GitHub Actions on every merge to the `prod` branch.

---

## Environment Variables

Copy `env.example` to `.env` and populate all required values before running locally or before configuring ECS task definitions.

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `DB_NAME` | MongoDB database name | `ai_engine_db` |
| `PORT` | HTTP port the server listens on | `8010` |
| `JWT_SECRET` | Shared secret for HS256 JWT verification (must match Backend API) | *(min 32 chars)* |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM inference | `sk-or-...` |
| `PASS_ENCRYPTION_FERNET_KEY` | 32-byte base64 Fernet key for credential encryption | *(generated)* |
| `N8N_API_KEY` | n8n API key | `n8n_...` |
| `N8N_SERVER_URL` | n8n API base URL | `https://n8n.yourdomain.com/api/v1` |
| `RABBITMQ_URL` | RabbitMQ AMQP URL | `amqp://user:pass@host:5672/` |
| `MCP_SERVER_URL` | Base URL of the MCP Server | `http://mcp:8011` |
| `BACKEND_API_URL` | Base URL of the Go Backend API | `https://api.yourdomain.com` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `DEBUG` | `false` | Enable uvicorn reload and verbose logging |
| `ENVIRONMENT` | `development` | `development` / `production` |
| `MONGO_DB_NAME` | `ai_engine_db` | MongoDB DB name for checkpointer (can differ from `DB_NAME`) |
| `NEO4J_URI` | — | Neo4j Bolt URI for Graphiti memory |
| `NEO4J_USER` | — | Neo4j username |
| `NEO4J_PASSWORD` | — | Neo4j password |
| `NEO4J_DATABASE` | `neo4j` | Neo4j database name |
| `GRAPHITI_LLM_MODEL` | `openai/gpt-4o-mini` | LLM for Graphiti entity extraction |
| `GRAPHITI_SMALL_MODEL` | `openai/gpt-4o-mini` | Fast model for Graphiti |
| `GRAPHITI_EMBEDDING_MODEL` | `openai/text-embedding-3-small` | Embedding model for Graphiti |
| `SUMMARIZATION_MODEL` | `openai/gpt-4o-mini` | LLM for conversation summarization |
| `VISION_CAPABLE` | `false` | Set `true` when using a vision-capable model |
| `SENTRY_DSN` | — | Sentry DSN for error tracking |
| `LANGFUSE_PUBLIC_KEY` | — | Langfuse observability |
| `LANGFUSE_SECRET_KEY` | — | Langfuse observability |
| `LANGSMITH_API_KEY` | — | LangSmith tracing |

### Generating a Fernet Key

```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

---

## Local Development

### Prerequisites

- Python 3.12+
- `uv` package manager (`pip install uv`)
- Docker (optional, for containerised testing)
- MongoDB (local or Atlas)
- RabbitMQ (local or CloudAMQP)
- n8n instance (optional for full feature testing)

### Steps

```bash
cd ai-engine/

# Install dependencies
uv sync

# Configure environment
cp env.example .env
# Edit .env with your values

# Start the server with hot-reload
uv run uvicorn main:app --host 0.0.0.0 --port 8010 --reload

# Or use the entry-point
uv run python main.py
```

The API will be available at:
- Swagger UI: http://localhost:8010/docs
- ReDoc: http://localhost:8010/redoc
- OpenAPI JSON: http://localhost:8010/openapi.json

### Local MongoDB

```bash
# Using Docker
docker run -d --name mongo -p 27017:27017 mongo:6

# Set in .env
MONGO_URI=mongodb://localhost:27017
```

### Local RabbitMQ

```bash
docker run -d --name rabbitmq \
  -p 5672:5672 -p 15672:15672 \
  rabbitmq:3-management

# Admin UI: http://localhost:15672 (guest/guest)
# Set in .env
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
```

---

## Docker Build

### Build Image

```bash
# From the repository root (context is the monorepo root)
docker build \
  --platform linux/amd64 \
  --file ai-engine/Dockerfile \
  -t ai-engine:latest .
```

### Run Container

```bash
docker run -d \
  --name ai-engine \
  -p 8010:8010 \
  --env-file ai-engine/.env \
  ai-engine:latest
```

### Dockerfile Notes

- Base image: `python:3.12-slim`
- Working directory: `/workspace/ai-engine`
- Port: `8010` (internal)
- Health check: `GET http://localhost:8010/health` every 15 s
- Startup: `uv run python main.py`
- Build uses `uv sync --frozen --no-dev` for reproducible installs

---

## AWS Deployment

### Infrastructure Overview

```
GitHub → ECR (container registry)
              │
              ▼
         ECS Cluster
              │
         ECS Service (ai-engine)
              │
         ECS Task (Fargate or EC2)
              │
    ┌─────────┴──────────┐
    │  ALB (port 8010)   │
    └────────────────────┘
```

### Required AWS Resources

| Resource | Description |
|----------|-------------|
| ECR Repository | Stores the Docker image (`ECR_REPOSITORY_AIENGINE`) |
| ECS Cluster | Hosts both ai-engine and mcp services (`ECS_CLUSTER`) |
| ECS Service | Runs the ai-engine task definition (`ECS_SERVICE_AIENGINE`) |
| Task Definition | Specifies container image, CPU/memory, env vars |
| IAM Role | Task execution role with ECR pull and Secrets Manager read permissions |
| ALB / Target Group | Routes HTTP/HTTPS traffic to the container |
| Security Group | Allows inbound on port 8010 from ALB SG |

### ECS Task Definition (key settings)

```json
{
  "family": "ai-engine",
  "containerDefinitions": [{
    "name": "ai-engine",
    "image": "<account>.dkr.ecr.<region>.amazonaws.com/<repo>:latest",
    "portMappings": [{ "containerPort": 8010 }],
    "environment": [
      { "name": "PORT", "value": "8010" }
    ],
    "secrets": [
      { "name": "MONGO_URI", "valueFrom": "arn:aws:secretsmanager:..." },
      { "name": "OPENROUTER_API_KEY", "valueFrom": "arn:aws:secretsmanager:..." }
    ],
    "healthCheck": {
      "command": ["CMD-SHELL", "curl -f http://localhost:8010/health || exit 1"],
      "interval": 15,
      "timeout": 10,
      "retries": 3,
      "startPeriod": 30
    }
  }],
  "cpu": "1024",
  "memory": "2048"
}
```

> Store sensitive values (API keys, passwords) in **AWS Secrets Manager** and reference them via `secrets` in the task definition — do not put them in `environment`.

---

## CI/CD Pipeline

### Trigger

The deployment pipeline runs on every push to the `prod` branch.

### Pipeline Steps (`deploy.yml`)

```
Push to prod branch
       │
       ▼
1. Checkout code (actions/checkout@v4)
       │
       ▼
2. Configure AWS credentials (aws-actions/configure-aws-credentials@v4)
       │
       ▼
3. Login to Amazon ECR (aws-actions/amazon-ecr-login@v2)
       │
       ▼
4. Set up Docker Buildx (docker/setup-buildx-action@v3)
       │
       ▼
5. docker build --platform linux/amd64 \
       --file ai-engine/Dockerfile \
       --cache-from $ECR_REGISTRY/$ECR_REPOSITORY:latest \
       -t $ECR_REGISTRY/$ECR_REPOSITORY:latest .
       │
       ▼
6. docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
       │
       ▼
7. aws ecs update-service --force-new-deployment
       └─ ECS pulls new image and performs rolling replacement
```

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user or role key ID with ECR/ECS permissions |
| `AWS_SECRET_ACCESS_KEY` | Corresponding secret |
| `AWS_REGION` | AWS region (e.g. `us-east-1`) |
| `ECR_REPOSITORY_AIENGINE` | ECR repository name for the AI Engine image |
| `ECS_CLUSTER` | ECS cluster name |
| `ECS_SERVICE_AIENGINE` | ECS service name for AI Engine |

---

## Rolling Deployment Strategy

ECS performs a **rolling update** by default:
1. New task starts, health check must pass within `startPeriod` (30 s).
2. Once healthy, old task receives a drain signal and stops accepting new connections.
3. Graceful shutdown: `timeout_graceful_shutdown=5` gives 5 seconds for in-flight requests to complete.

To roll back, re-deploy the previous image tag or force a re-deploy of the prior task definition revision.

---

## Stopping the Server

### Local (stop scripts)

```bash
# Linux/macOS
./stop-server.sh

# Windows PowerShell
.\stop-server.ps1

# Windows Batch
.\stop-server.bat
```

### Docker

```bash
docker stop ai-engine
```

### ECS

```bash
# Scale down the service
aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service $ECS_SERVICE_AIENGINE \
  --desired-count 0
```

---

## Monitoring and Observability

| Tool | Configuration | Purpose |
|------|--------------|---------|
| CloudWatch Logs | ECS log driver | Container stdout/stderr |
| Sentry | `SENTRY_DSN` env var | Exception tracking |
| Langfuse | `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` | LLM observability |
| LangSmith | `LANGSMITH_API_KEY` | LangChain traces |
| OpenTelemetry | Auto-configured | Span export (OTLP) |

### Log Format

The application uses `loguru` for structured logging. Log levels:
- `INFO` — startup events, request lifecycle
- `WARNING` — optional integration failures (Graphiti, RMQ)
- `ERROR` — handled exceptions with context
- `DEBUG` — verbose mode (set `DEBUG=true`)
