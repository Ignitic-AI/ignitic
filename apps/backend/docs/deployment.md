# Deployment & CI/CD Guide
## Ignitic AI — Backend API
**Version:** 1.0  

---

## Overview

The backend is deployed as a Docker container on **AWS ECS** (Elastic Container Service). Images are stored in **AWS ECR** (Elastic Container Registry). Deployments are triggered automatically via **GitHub Actions** whenever code is pushed to the `prod` branch.

---

## Architecture

```
Developer
    │
    │ git push → prod branch
    ▼
GitHub Actions (deploy.yml)
    │
    ├─ 1. Checkout code
    ├─ 2. Configure AWS credentials
    ├─ 3. Login to ECR
    ├─ 4. Build Docker image (linux/amd64)
    ├─ 5. Push image to ECR (tagged :latest)
    └─ 6. Force ECS service redeployment
                │
                ▼
         AWS ECS Cluster
          └─ ECS Service
               └─ Task (Docker container)
                    └─ Backend binary
```

---

## CI/CD Pipeline

The CI/CD workflow is defined in `.github/workflows/deploy.yml`.

### Trigger

```yaml
on:
  push:
    branches: [prod]
```

Deployments are triggered only when commits are pushed to the `prod` branch. To deploy, merge changes into `prod` (typically via a pull request from `main` or a release branch).

### Workflow Steps

| Step | Action | Description |
|---|---|---|
| 1 | `actions/checkout@v4` | Check out source code |
| 2 | `aws-actions/configure-aws-credentials@v4` | Authenticate with AWS using stored GitHub secrets |
| 3 | `aws-actions/amazon-ecr-login@v2` | Log in to the ECR registry |
| 4 | `docker build` | Build the image for `linux/amd64` platform |
| 5 | `docker push` | Push the image tagged `:latest` to ECR |
| 6 | `aws ecs update-service` | Force a new ECS deployment (rolling update) |

### Required GitHub Secrets

These secrets must be configured in the repository's **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user access key ID |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret access key |
| `AWS_REGION` | AWS region (e.g., `us-east-1`) |
| `ECR_REPOSITORY` | ECR repository name (not the full URI) |
| `ECS_CLUSTER` | ECS cluster name |
| `ECS_SERVICE` | ECS service name |

---

## Docker Build

The `Dockerfile` uses a **multi-stage build** for a minimal production image:

### Build Stage (`golang:1.23-alpine`)

```dockerfile
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .
```

- `CGO_ENABLED=0` produces a fully static binary.
- `GOOS=linux` targets Linux explicitly (required for cross-compilation on macOS).

### Final Stage (`alpine:latest`)

```dockerfile
RUN adduser -D -s /bin/sh appuser
COPY --from=builder /app/main .
COPY --from=builder /app/database/migrations ./database/migrations
USER appuser
EXPOSE 8080
CMD ["./main"]
```

Key security properties:
- Non-root user (`appuser`) is created and used.
- Only the compiled binary and migration files are copied into the final image.
- No build toolchain or source code exists in the production image.

### Local Build

```bash
docker build -t backend:local .
```

### Local Run

```bash
docker run -p 8080:8080 \
  -e DB_HOST=host.docker.internal \
  -e DB_PASSWORD=yourpassword \
  -e JWT_SECRET=yoursecret \
  -e ENCRYPTION_KEY=32-char-encryption-key \
  backend:local
```

---

## Environment Configuration

All configuration is injected via environment variables. In production, these are provided through ECS Task Definition environment variables or AWS Secrets Manager.

### Required Variables

| Variable | Description | Example |
|---|---|---|
| `SERVER_PORT` | HTTP port | `8080` |
| `ENVIRONMENT` | Runtime environment | `production` |
| `AI_ENGINE_URL` | URL of the AI Engine service | `http://ai-engine:8010` |
| `DB_HOST` | PostgreSQL host | `db.internal` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | *(secret)* |
| `DB_NAME` | Database name | `ignitic` |
| `DB_SSL_MODE` | SSL mode | `require` |
| `JWT_SECRET` | JWT signing key | *(32+ char secret)* |
| `ENCRYPTION_KEY` | AES encryption key | *(exactly 32 bytes)* |
| `BREVO_API_KEY` | Brevo email API key | *(secret)* |
| `SENDER_EMAIL` | Outbound email address | `noreply@ignitic.ai` |
| `FRONTEND_URL` | Frontend URL for email links | `https://app.ignitic.ai` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | *(from Cloudinary dashboard)* |
| `CLOUDINARY_API_KEY` | Cloudinary API key | *(secret)* |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | *(secret)* |
| `RABBITMQ_URL` | AMQP connection URL | `amqp://user:pass@rabbitmq:5672/` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins | `https://app.ignitic.ai` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | *(from Google Console)* |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | *(secret)* |
| `GOOGLE_REDIRECT_URI` | Google OAuth redirect URI | `https://api.ignitic.ai/api/v1/google-oauth/callback` |

### Optional Variables

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_RPS` | `100` | Global rate limit (requests per second) |
| `REDIS_HOST` | `localhost` | Redis host (reserved for future use) |
| `REDIS_PORT` | `6379` | Redis port |
| `BACKEND_MAX_WORKERS` | `10` | Max background workers |
| `BACKEND_TASK_TIMEOUT` | `300` | Task timeout in seconds |
| `BACKEND_COMPLIANCE_MODE` | `SOC2_GDPR` | Compliance logging mode |
| `BACKEND_AUTOMATION_ENABLED` | `true` | Enable automation features |

---

## Running Locally (Without Docker)

### Prerequisites

- Go 1.23+
- PostgreSQL 14+
- RabbitMQ (optional, for agent chat)

### Steps

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` with your local values.

3. Start RabbitMQ (optional):
   ```bash
   ./start-rabbitmq.sh
   ```

4. Run the server:
   ```bash
   go run *.go
   ```

5. The server starts on `http://localhost:8080`.

6. Access Swagger UI at `http://localhost:8080/swagger/index.html`.

---

## Database Migrations

Migrations run automatically on server startup via Goose. No manual migration step is required in production.

If you need to run migrations manually:

```bash
# Install goose
go install github.com/pressly/goose/v3/cmd/goose@latest

# Run all pending migrations
goose -dir database/migrations postgres "host=localhost user=postgres dbname=ignitic sslmode=disable" up

# Rollback last migration
goose -dir database/migrations postgres "host=localhost user=postgres dbname=ignitic sslmode=disable" down

# Check migration status
goose -dir database/migrations postgres "host=localhost user=postgres dbname=ignitic sslmode=disable" status
```

---

## AWS Infrastructure

### ECS Configuration

The backend runs as an ECS service. The ECS Task Definition should:

- Use the ECR image URI with the `:latest` tag.
- Expose port `8080`.
- Inject all required environment variables (via parameter store or secrets manager).
- Assign the appropriate IAM task role if AWS Secrets Manager is used.
- Configure health check: `GET /health` → expect `200`.

### IAM Permissions

The GitHub Actions IAM user needs the following minimum permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability",
        "ecr:CompleteLayerUpload",
        "ecr:GetDownloadUrlForLayer",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["ecs:UpdateService"],
      "Resource": "<ECS-service-ARN>"
    }
  ]
}
```

### Networking

- The ECS service should be placed in a private subnet.
- An Application Load Balancer (ALB) should front the service and handle TLS termination.
- Security groups should allow inbound 8080 only from the ALB, and outbound to the RDS instance and RabbitMQ.

---

## Rollback

ECS maintains previous task definition revisions. To roll back:

1. In the AWS Console, go to **ECS → Clusters → \<cluster\> → Services → \<service\>**.
2. Update the service to use the previous task definition revision.
3. ECS will perform a rolling update back to the previous version.

Or via CLI:
```bash
aws ecs update-service \
  --cluster <cluster-name> \
  --service <service-name> \
  --task-definition <task-definition-family>:<previous-revision>
```

---

## Monitoring

- **AWS CloudWatch** — ECS task logs are streamed to CloudWatch Log Groups.
- **Health endpoint** — `GET /health` returns `{"status": "healthy"}` for ALB health checks.
- **Structured logs** — All API activity is stored in the `logs` PostgreSQL table and queryable via the Logs API.
- **RabbitMQ management** — Monitor queue depth and consumer status via the RabbitMQ management UI.
