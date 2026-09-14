# Build from the repository root:
#   docker build -f apps/ai-engine/Dockerfile .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    HOST=0.0.0.0 \
    PORT=8010

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

WORKDIR /workspace/ai-engine

COPY apps/ai-engine/pyproject.toml apps/ai-engine/uv.lock ./
RUN RUSTFLAGS="--cfg reqwest_unstable" uv sync --frozen --no-dev --no-install-project

COPY apps/ai-engine/ ./

EXPOSE 8010

HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8010/health || exit 1

CMD ["uv", "run", "python", "main.py"]
