FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

WORKDIR /workspace/mcp

COPY mcp/pyproject.toml mcp/uv.lock ./
RUN RUSTFLAGS="--cfg reqwest_unstable" uv sync --frozen --no-dev --no-install-project

COPY mcp/ /workspace/mcp/
COPY ai-engine/ /workspace/ai-engine/

EXPOSE 8011

CMD ["uv", "run", "python", "main.py"]
