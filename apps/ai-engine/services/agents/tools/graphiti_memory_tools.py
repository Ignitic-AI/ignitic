"""
LangChain tools that give agents long-term memory backed by Graphiti / Neo4j.

Two tools are exposed:

* ``save_memory``   – persist an important episode to the knowledge graph.
* ``search_memory`` – retrieve relevant facts from the knowledge graph.

Both tools receive the ``RunnableConfig`` via :class:`~langchain_core.tools.InjectedToolArg`
so they can automatically scope memories to the current user/organisation.
"""

from datetime import datetime, timezone
from typing import Annotated

from graphiti_core.nodes import EpisodeType
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import InjectedToolArg, tool
from loguru import logger

from services.agents.graphiti_client import get_graphiti_client


def _get_group_id(config: RunnableConfig) -> str:
    """
    Derive the Graphiti ``group_id`` (memory namespace) from the run config.

    Priority: org_id → u_id.  This ensures that all agents belonging to the
    same organisation share a single knowledge graph namespace.
    """
    configurable = config.get("configurable", {}) if config else {}
    org_id = configurable.get("org_id")
    u_id = configurable.get("u_id")
    group_id = org_id or u_id
    if not group_id:
        raise RuntimeError(
            "Neither org_id nor u_id found in RunnableConfig – "
            "cannot determine the memory namespace."
        )
    return str(group_id)


# ---------------------------------------------------------------------------
# save_memory
# ---------------------------------------------------------------------------


@tool
async def save_memory(
    episode_name: str,
    episode_content: str,
    source_description: str,
    config: Annotated[RunnableConfig, InjectedToolArg],
) -> str:
    """
    Save an important piece of information to long-term knowledge-graph memory.

    Use this tool whenever you learn something significant about the user,
    organisation, preferences, decisions, or any fact that would be valuable
    in future conversations.

    Args:
        episode_name: A short, descriptive title for the memory
            (e.g. "User's preferred communication style",
             "Company budget constraint for Q4").
        episode_content: The full text of the information to remember.
            Be specific and include all relevant context.
        source_description: A brief label describing the source of this memory
            (e.g. "user conversation", "agent observation", "task outcome").
    """
    try:
        group_id = _get_group_id(config)
        graphiti = get_graphiti_client()

        await graphiti.add_episode(
            name=episode_name,
            episode_body=episode_content,
            source=EpisodeType.text,
            source_description=source_description,
            reference_time=datetime.now(timezone.utc),
            group_id=group_id,
        )

        logger.info(f"🧠 Memory saved | group={group_id} | name='{episode_name}'")
        return f"Memory '{episode_name}' saved successfully to the knowledge graph."

    except Exception as exc:
        logger.warning(f"⚠️  save_memory failed: {exc}")
        return f"Failed to save memory: {exc}"


# ---------------------------------------------------------------------------
# search_memory
# ---------------------------------------------------------------------------


@tool
async def search_memory(
    query: str,
    config: Annotated[RunnableConfig, InjectedToolArg],
) -> str:
    """
    Search long-term knowledge-graph memory for facts relevant to a query.

    Use this tool when you need to recall past information about the user,
    organisation, preferences, or any previously learned facts before
    answering a question or making a decision.

    Args:
        query: A natural-language question or keyword phrase describing
            what you want to recall
            (e.g. "What does the user prefer for email tone?",
             "company product pricing strategy").

    Returns:
        A list of relevant facts retrieved from the knowledge graph,
        or a message indicating that no relevant memories were found.
    """
    try:
        group_id = _get_group_id(config)
        graphiti = get_graphiti_client()

        edges = await graphiti.search(
            query,
            group_ids=[group_id],
            num_results=10,
        )

        if not edges:
            logger.debug(
                f"🔍 search_memory: no results for query='{query}' group={group_id}"
            )
            return "No relevant memories found for this query."

        facts = "\n".join(f"- {edge.fact}" for edge in edges)
        logger.info(f"🔍 search_memory: found {len(edges)} fact(s) | group={group_id}")
        return f"Relevant memories retrieved:\n{facts}"

    except Exception as exc:
        logger.warning(f"⚠️  search_memory failed: {exc}")
        return f"Failed to search memory: {exc}"
