"""
Singleton Graphiti client for long-term knowledge graph memory.

Graphiti requires Neo4j as its graph database backend and an LLM provider.
This module configures Graphiti to use OpenRouter (OpenAI-compatible API) so
the same provider/key used for the agent LLMs is also used for memory extraction.

Required environment variables:
  NEO4J_URI               - bolt URI of your Neo4j instance  (default: bolt://localhost:7687)
  NEO4J_USER              - Neo4j username                   (default: neo4j)
  NEO4J_PASSWORD          - Neo4j password                   (required)
  OPENROUTER_API_KEY      - API key reused from the main agent config

Optional Neo4j overrides:
  NEO4J_DATABASE          - target database name inside the Neo4j instance
                            (default: neo4j).
                            Neo4j Aura users: set this to your Aura database name
                            if the default 'neo4j' routing lookup fails.

Optional model overrides (fall back to sensible defaults):
  GRAPHITI_LLM_MODEL        - main model for entity/edge extraction
                              (default: openai/gpt-4o-mini)
  GRAPHITI_SMALL_MODEL      - lightweight model for cheaper steps & reranking
                              (default: openai/gpt-4o-mini)
  GRAPHITI_EMBEDDING_MODEL  - embedding model
                              (default: openai/text-embedding-3-small)
"""

import os
from dotenv import load_dotenv
from graphiti_core import Graphiti
from graphiti_core.driver.neo4j_driver import Neo4jDriver
from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
from graphiti_core.cross_encoder.openai_reranker_client import OpenAIRerankerClient
from loguru import logger

load_dotenv()

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# ----- module-level singleton -----
_graphiti_client: Graphiti | None = None


async def init_graphiti_client() -> Graphiti:
    """
    Initialize the Graphiti client and build Neo4j indices/constraints.

    Safe to call multiple times - subsequent calls are no-ops that return the
    existing client.  Called once from the FastAPI lifespan handler.
    """
    global _graphiti_client

    if _graphiti_client is not None:
        return _graphiti_client

    neo4j_uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    neo4j_user = os.getenv("NEO4J_USER", "neo4j")
    neo4j_password = os.getenv("NEO4J_PASSWORD")
    neo4j_database = os.getenv("NEO4J_DATABASE", "neo4j")

    if not neo4j_password:
        raise ValueError(
            "NEO4J_PASSWORD environment variable must be set to enable "
            "long-term knowledge-graph memory."
        )

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError(
            "OPENROUTER_API_KEY environment variable must be set to enable "
            "long-term knowledge-graph memory."
        )

    llm_model = os.getenv("GRAPHITI_LLM_MODEL", "openai/gpt-4o-mini")
    small_model = os.getenv("GRAPHITI_SMALL_MODEL", "openai/gpt-4o-mini")
    embedding_model = os.getenv(
        "GRAPHITI_EMBEDDING_MODEL", "openai/text-embedding-3-small"
    )

    logger.info(
        f"🔗 Connecting to Neo4j at {neo4j_uri} db='{neo4j_database}' | "
        f"LLM={llm_model} | small={small_model} | embed={embedding_model}"
    )

    llm_config = LLMConfig(
        api_key=api_key,
        model=llm_model,
        small_model=small_model,
        base_url=OPENROUTER_BASE_URL,
    )

    # Build the driver explicitly so we can set the target database name.
    # Graphiti's default Neo4jDriver constructor hardcodes database='neo4j',
    # which fails on Aura instances where the database has a different name.
    graph_driver = Neo4jDriver(
        neo4j_uri, neo4j_user, neo4j_password, database=neo4j_database
    )

    client = Graphiti(
        graph_driver=graph_driver,
        llm_client=OpenAIGenericClient(config=llm_config),
        embedder=OpenAIEmbedder(
            config=OpenAIEmbedderConfig(
                api_key=api_key,
                embedding_model=embedding_model,
                base_url=OPENROUTER_BASE_URL,
            )
        ),
        cross_encoder=OpenAIRerankerClient(
            config=LLMConfig(
                api_key=api_key,
                model=small_model,
                base_url=OPENROUTER_BASE_URL,
            )
        ),
    )
    # Keep a direct reference to the driver for explicit close
    client.driver = graph_driver

    # Idempotent - creates indices & constraints if they don't exist yet.
    await client.build_indices_and_constraints()

    _graphiti_client = client
    logger.info("✅ Graphiti knowledge-graph client initialised")
    return client


def get_graphiti_client() -> Graphiti:
    """
    Return the already-initialised Graphiti singleton.

    Raises RuntimeError if called before :func:`init_graphiti_client`.
    """
    if _graphiti_client is None:
        raise RuntimeError(
            "Graphiti client is not initialised. "
            "Ensure init_graphiti_client() is awaited during application startup."
        )
    return _graphiti_client


async def close_graphiti_client() -> None:
    """Close the Graphiti / Neo4j connection.  Called from the lifespan shutdown."""
    global _graphiti_client
    if _graphiti_client is not None:
        await _graphiti_client.close()
        _graphiti_client = None
        logger.info("✅ Graphiti client closed")
