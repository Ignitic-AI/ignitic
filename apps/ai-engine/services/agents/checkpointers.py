from typing import List

from langgraph.checkpoint.mongodb import AsyncMongoDBSaver
from pymongo import AsyncMongoClient
from dotenv import load_dotenv
from langchain_core.runnables.schema import StreamEvent
import os

from models.agent import Agent

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

# Global variable to hold the checkpointer instance
mongo_checkpointer = None


async def init_mongo_checkpointer():
    """Initialize the MongoDB checkpointer within an async context"""
    global mongo_checkpointer

    if mongo_checkpointer is None:
        if not MONGO_URI or not MONGO_DB_NAME:
            raise ValueError(
                "MONGO_URI and MONGO_DB_NAME environment variables must be set"
            )

        # Create MongoDB client and checkpointer
        mongo_client = AsyncMongoClient(MONGO_URI)
        mongo_checkpointer = AsyncMongoDBSaver(
            client=mongo_client,
            db_name=MONGO_DB_NAME,
            checkpoint_collection_name="chat_checkpoints",
        )

    return mongo_checkpointer


def get_mongo_checkpointer():
    """Get the initialized checkpointer instance"""
    if mongo_checkpointer is None:
        raise RuntimeError(
            "MongoDB checkpointer not initialized. Call init_mongo_checkpointer() first."
        )
    return mongo_checkpointer


async def isCheckpointerLastMessageEqualTo(thread_id: str, message: str) -> bool:
    """Check if the last message in the checkpoint for the given thread_id matches the provided message."""
    if mongo_checkpointer is None:
        raise RuntimeError(
            "MongoDB checkpointer not initialized. Call init_mongo_checkpointer() first."
        )

    # Fetch the latest checkpoint for the given thread_id
    latest_checkpoint = await mongo_checkpointer.aget(
        config={"configurable": {"thread_id": thread_id}}
    )

    if latest_checkpoint and latest_checkpoint["channel_values"]["messages"]:
        last_message = latest_checkpoint["channel_values"]["messages"][-1]
        if hasattr(last_message, "content"):
            last_message_content = last_message.content
        else:
            last_message_content = last_message["content"]

        return last_message_content == message

    return False


def resolve_agent_name_from_event(evt: StreamEvent, agents: List[Agent]) -> str:
    """Map a LangGraph node identifier to a human-readable display name.

    Sub-agents in a multi-agent graph run inside a parent node whose
    ``langgraph_node`` is the generic label ``"agent"``.  The real
    agent identifier is the first segment of ``checkpoint_ns``, e.g.:
        ``"product_researcher:7bc9445b-..."``  →  ``"product_researcher"``
    """
    # Build identifier → display name lookup used across the whole stream.
    # "super_agent" is the implicit root node created by LangGraph and is
    # not present in the `agents` list, so we add it explicitly.
    _node_name: dict[str, str] = {"super_agent": "Super Agent"}
    for _a in agents:
        _node_name[_a.identifier] = _a.name

    meta: dict = evt.get("metadata", {})
    node_id: str = meta.get("langgraph_node") or ""

    # Non-generic node names (super_agent, summarize, router_node, …)
    if node_id and node_id != "agent":
        return _node_name.get(node_id) or node_id.replace("_", " ").title()

    # Generic "agent" node — inspect checkpoint_ns for the real id.
    # checkpoint_ns looks like "product_researcher:<uuid>|agent:<uuid>"
    # or just "product_researcher:<uuid>" for a single sub-graph level.
    checkpoint_ns: str = meta.get("checkpoint_ns") or ""
    if checkpoint_ns:
        # Take the outermost segment (before the first "|"), then the
        # identifier before the first ":" within that segment.
        outermost = checkpoint_ns.split("|")[0]
        sub_id = outermost.split(":")[0].strip()
        if sub_id:
            return _node_name.get(sub_id) or sub_id.replace("_", " ").title()

    # Fallback: single-agent graph or unknown topology
    if len(agents) == 1:
        return agents[0].name
    return "Assistant"
