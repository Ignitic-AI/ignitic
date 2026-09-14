# Build from the repository root (the MCP image also bundles apps/ai-engine):
#   docker build -f apps/mcp/Dockerfile .
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    HOST=0.0.0.0 \
    PORT=8011

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

WORKDIR /workspace/mcp

COPY apps/mcp/pyproject.toml apps/mcp/uv.lock ./
RUN RUSTFLAGS="--cfg reqwest_unstable" uv sync --frozen --no-dev --no-install-project

COPY apps/mcp/ /workspace/mcp/
COPY apps/ai-engine/ /workspace/ai-engine/

EXPOSE 8011

HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8011/health || exit 1

CMD ["uv", "run", "python", "main.py"]
