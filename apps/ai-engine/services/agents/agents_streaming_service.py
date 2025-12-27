"""
Agent Streaming Service - Provides async generator for streaming agent responses
"""

import asyncio
from typing import List, AsyncGenerator, Optional
from models.agent import Agent
from services.agents.llms import get_llm
from services.agents.checkpointers import (
    get_mongo_checkpointer,
    isCheckpointerLastMessageEqualTo,
)
from services.agents.agents_service import AgentResolver
from core.auth import AuthProvider
from loguru import logger


async def astream_agents(
    agents: List[Agent],
    message: str,
    thread_id: str,
    auth: AuthProvider,
    model: str | None = None,
) -> AsyncGenerator[dict, None]:
    """
    Stream agent responses chunk by chunk.
    
    Yields dictionaries with:
        - chunk_index: int - sequential index of the chunk
        - content: str - the text content of this chunk
        - is_final: bool - True if this is the last chunk
    
    Uses buffered streaming to yield meaningful chunks (sentences/phrases)
    rather than individual tokens.
    """
    effective_llm = get_llm(model)
    agent = await AgentResolver(model_llm=effective_llm, auth=auth).resolve(agents)

    RETRY_COUNT = 3
    INITIAL_DELAY = 1  # seconds
    MAX_DELAY = 10  # seconds

    delay = INITIAL_DELAY
    chunk_index = 0
    buffer = ""
    
    # Delimiters for buffered chunking (sentences/phrases)
    CHUNK_DELIMITERS = [".", "!", "?", "\n", ";"]
    MIN_CHUNK_SIZE = 20  # Minimum characters before checking for delimiters

    # Prepare input based on checkpointer state
    if await isCheckpointerLastMessageEqualTo(thread_id, message):
        input_data = {}
    else:
        input_data = {
            "messages": [
                {
                    "role": "user",
                    "content": message,
                }
            ]
        }

    config = {
        "configurable": {
            "thread_id": thread_id,
        }
    }

    retry_count = RETRY_COUNT
    while retry_count > 0:
        try:
            # Use astream_events for detailed streaming
            async for event in agent.astream_events(input_data, config=config, version="v2"):
                # Extract content from chat model stream events
                if event["event"] == "on_chat_model_stream":
                    chunk_content = ""
                    
                    # Try to get agent name from metadata
                    agent_name = event.get("metadata", {}).get("langgraph_node")
                    
                    # Fallback for single agent or if node name is generic
                    if not agent_name or agent_name == "agent":
                        if len(agents) == 1:
                            agent_name = agents[0].name
                        else:
                            agent_name = "Assistant"

                    # Handle different chunk structures
                    data = event.get("data", {})
                    chunk = data.get("chunk")
                    
                    if chunk:
                        # AIMessageChunk structure
                        if hasattr(chunk, "content"):
                            chunk_content = chunk.content
                        elif isinstance(chunk, dict) and "content" in chunk:
                            chunk_content = chunk["content"]
                    
                    if chunk_content:
                        buffer += chunk_content
                        
                        # Check if we should emit a chunk (buffered approach)
                        if len(buffer) >= MIN_CHUNK_SIZE:
                            # Look for a delimiter to make clean breaks
                            for delim in CHUNK_DELIMITERS:
                                delim_pos = buffer.rfind(delim)
                                if delim_pos > 0:
                                    # Emit up to and including the delimiter
                                    emit_content = buffer[:delim_pos + 1]
                                    buffer = buffer[delim_pos + 1:]
                                    
                                    yield {
                                        "chunk_index": chunk_index,
                                        "content": emit_content,
                                        "is_final": False,
                                        "agent_name": agent_name,
                                    }
                                    chunk_index += 1
                                    break
            
            # Emit any remaining content as final chunk
            if buffer:
                yield {
                    "chunk_index": chunk_index,
                    "content": buffer,
                    "is_final": True,
                    "agent_name": agent_name if 'agent_name' in locals() else (agents[0].name if len(agents) == 1 else "Assistant"),
                }
            elif chunk_index > 0:
                # If we emitted chunks but buffer is empty, mark the last one as final
                # This case is handled by updating the last yield
                yield {
                    "chunk_index": chunk_index,
                    "content": "",
                    "is_final": True,
                    "agent_name": agent_name if 'agent_name' in locals() else (agents[0].name if len(agents) == 1 else "Assistant"),
                }
            else:
                # No content was generated
                yield {
                    "chunk_index": 0,
                    "content": "",
                    "is_final": True,
                    "agent_name": agents[0].name if len(agents) == 1 else "Assistant",
                }
            
            # Success - break out of retry loop
            break
            
        except Exception as e:
            retry_count -= 1
            logger.warning(f"Streaming attempt failed: {e}, retries left: {retry_count}")
            
            if retry_count == 0:
                # Yield error as final chunk
                yield {
                    "chunk_index": chunk_index,
                    "content": f"Error: Agent streaming failed after retries: {str(e)}",
                    "is_final": True,
                    "agent_name": "System",
                }
                return
            
            await asyncio.sleep(delay)
            delay = min(delay * 2, MAX_DELAY)
            
            # Reset state for retry
            chunk_index = 0
            buffer = ""
