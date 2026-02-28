import asyncio
from typing import AsyncGenerator, List, TypedDict
from langgraph_supervisor import create_supervisor
from models.agent import Agent, AgentState
from services.agents.agent_hooks import AgentHooks
from services.agents.llms import get_llm
from services.agents.prompts import (
    super_agent_prompt,
    MEMORY_SINGLE_AGENT_GUIDANCE,
    MEMORY_SUB_AGENT_GUIDANCE,
)
from services.agents.checkpointers import (
    get_mongo_checkpointer,
    isCheckpointerLastMessageEqualTo,
)
from services.agents.memory_stores import get_mongo_memory_store
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent
from models.chat import PrebuiltAgents
from services.agents.mcp_client import MCPClientService
from core.auth import AuthProvider
from fastapi import HTTPException
from langchain_core.runnables import RunnableConfig
from models.custom_messages import ImageMessage, FileMessage
from services.agents.tools.graphiti_memory_tools import save_memory, search_memory
from loguru import logger
import aiohttp
import io


async def _process_file_url(url: str, index: int):
    filename = url.split("/")[-1]
    
    # Cloudinary raw uploads have no extension, so we check any non-PDF file
    if not filename.lower().endswith(".pdf"):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        content = await response.read()
                        
                        # Try parsing with MarkItDown (Supports DOCX, PPTX, XLSX, etc.)
                        try:
                            from markitdown import MarkItDown
                            import tempfile
                            import os

                            # Write the raw bytes to a temporary file for MarkItDown to process
                            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                                temp_file.write(content)
                                temp_file_path = temp_file.name

                            try:
                                md = MarkItDown()
                                result = md.convert(temp_file_path)
                                extracted_text = result.text_content
                                
                                doc_name = filename if "." in filename else f"document_{index+1}"
                                formatted_content = f"""
I have uploaded a document for your reference.
FILENAME: {doc_name}
CONTENT START:
{extracted_text}
CONTENT END.
"""
                                return FileMessage(content=formatted_content)
                            finally:
                                # Clean up the temporary file
                                if os.path.exists(temp_file_path):
                                    os.remove(temp_file_path)
                        except Exception as parse_err:
                            logger.error(f"Failed to parse with MarkItDown for {url}: {parse_err}")
                            # Fallback below

        except Exception as e:
            logger.error(f"Failed to fetch or process file {url}: {e}")
            
    # For PDFs and other types (or fallback if parsing failed)
    return FileMessage(
        content=[
            {"type": "text", "text": f"File {index + 1}:"},
            {
                "type": "file",
                "file": {
                    "file_data": url,
                    "filename": filename if "." in filename else f"file_{index+1}",
                },
            },
        ]
    )
async def ainvoke_agents(
    agents: List[Agent],
    message: str,
    thread_id: str,
    chat_id: str,
    auth: AuthProvider,
    model: str | None = None,
    image_urls: list[str] | None = None,
    file_urls: list[str] | None = None,
):
    effective_llm = get_llm(model)
    agent = await AgentResolver(model_llm=effective_llm, auth=auth).resolve(agents)

    RETRY_COUNT = 3
    INITIAL_DELAY = 1  # seconds
    MAX_DELAY = 10  # seconds

    delay = INITIAL_DELAY
    agent_response = None

    while agent_response is None and RETRY_COUNT > 0:
        try:
            if (
                not image_urls
                and not file_urls
                and await isCheckpointerLastMessageEqualTo(thread_id, message)
            ):
                input_data = {}
            else:
                messages: list = []
                if image_urls:
                    for i, url in enumerate(image_urls):
                        messages.append(
                            ImageMessage(
                                content=[
                                    {"type": "text", "text": f"Image {i + 1}:"},
                                    {"type": "image_url", "image_url": {"url": url}},
                                ]
                            )
                        )
                if file_urls:
                    for i, url in enumerate(file_urls):
                        file_msg = await _process_file_url(url, i)
                        messages.append(file_msg)
                messages.append({"role": "user", "content": message})
                input_data = {"messages": messages}
            agent_response = await agent.ainvoke(
                input_data,
                config={
                    "configurable": {
                        "thread_id": thread_id,
                        "u_id": auth.get_user().id,
                        "org_id": auth.get_user().org_id,
                        "chat_id": chat_id,
                        "auth": auth.get_token(),
                        "agents": [
                            {
                                "identifier": agent.identifier,
                                "name": agent.name,
                            }
                            for agent in agents
                        ],
                    }
                },
            )
        except Exception as e:
            RETRY_COUNT -= 1
            if RETRY_COUNT == 0:
                raise Exception(f"Agent failed: {str(e)}")
            await asyncio.sleep(delay)
            delay = min(delay * 2, MAX_DELAY)  # Exponential backoff
    if agent_response is None:
        raise Exception("Agent failed after retries")
    return agent_response


class AgentStreamResponseChunk(TypedDict):
    chunk_index: int
    content: str
    is_final: bool
    agent_name: str


async def astream_agents(
    agents: List[Agent],
    message: str,
    thread_id: str,
    chat_id: str,
    auth: AuthProvider,
    model: str | None = None,
    image_urls: list[str] | None = None,
    file_urls: list[str] | None = None,
) -> AsyncGenerator[AgentStreamResponseChunk, None]:
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
    if (
        not image_urls
        and not file_urls
        and await isCheckpointerLastMessageEqualTo(thread_id, message)
    ):
        input_data = {}
    else:
        stream_messages: list = []
        if image_urls:
            for i, url in enumerate(image_urls):
                stream_messages.append(
                    ImageMessage(
                        content=[
                            {"type": "text", "text": f"Image {i + 1}:"},
                            {"type": "image_url", "image_url": {"url": url}},
                        ]
                    )
                )
        if file_urls:
            for i, url in enumerate(file_urls):
                file_msg = await _process_file_url(url, i)
                stream_messages.append(file_msg)
        stream_messages.append({"role": "user", "content": message})
        input_data = {"messages": stream_messages}

    config: RunnableConfig = {
        "configurable": {
            "thread_id": thread_id,
            "u_id": auth.get_user().id,
            "org_id": auth.get_user().org_id,
            "chat_id": chat_id,
            "auth": auth.get_token(),
            "agents": [
                {
                    "identifier": agent.identifier,
                    "name": agent.name,
                }
                for agent in agents
            ],
        }
    }

    retry_count = RETRY_COUNT
    while retry_count > 0:
        try:
            # Use astream_events for detailed streaming
            async for event in agent.astream_events(
                input_data, config=config, version="v2"
            ):
                # from langchain_core.load import dumpd

                # Extract content from chat model stream events
                # if event["event"] == "on_chain_stream":
                #     with open(
                #         "examples/chain_stream_event_2.jsonl", "a", encoding="utf-8"
                #     ) as f:
                #         f.write(json.dumps(dumpd(event), ensure_ascii=False) + "\n")

                # if event["event"] == "on_chain_end":
                #     dump_json_to_file(event, "examples/agent_stream_event_chain_end_continue.json")

                if event["event"] == "on_chat_model_stream":
                    chunk_content = ""

                    # Try to get agent name from metadata
                    agent_name = event.get("metadata", {}).get(
                        "langgraph_node",
                        agents[0].name if len(agents) == 1 else "Assistant",
                    )

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
                                    emit_content = buffer[: delim_pos + 1]
                                    buffer = buffer[delim_pos + 1 :]

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
                    "agent_name": agents[0].name if len(agents) == 1 else "Assistant",
                }
            elif chunk_index > 0:
                # If we emitted chunks but buffer is empty, mark the last one as final
                # This case is handled by updating the last yield
                yield {
                    "chunk_index": chunk_index,
                    "content": "",
                    "is_final": True,
                    "agent_name": agents[0].name if len(agents) == 1 else "Assistant",
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
            logger.warning(
                f"Streaming attempt failed: {e}, retries left: {retry_count}"
            )

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


async def astream_agents_v2(
    agents: List[Agent],
    message: str,
    thread_id: str,
    chat_id: str,
    auth: AuthProvider,
    model: str | None = None,
) -> AsyncGenerator[AgentStreamResponseChunk, None]:
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

    config: RunnableConfig = {
        "configurable": {
            "thread_id": thread_id,
            "u_id": auth.get_user().id,
            "org_id": auth.get_user().org_id,
            "chat_id": chat_id,
            "auth": auth.get_token(),
            "agents": [
                {
                    "identifier": agent.identifier,
                    "name": agent.name,
                }
                for agent in agents
            ],
        }
    }

    retry_count = RETRY_COUNT
    while retry_count > 0:
        try:
            # Use astream_events for detailed streaming
            async for chunk, metadata in agent.astream(
                input_data, config=config, stream_mode="messages"
            ):
                print("Chunk metadata:", metadata)
                print("Chunk content:", chunk)

            # Success - break out of retry loop
            break

        except Exception as e:
            retry_count -= 1
            logger.warning(
                f"Streaming attempt failed: {e}, retries left: {retry_count}"
            )

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


class AgentService:
    def __init__(self, auth: AuthProvider):
        self._auth = auth

    async def get_user_agents(self, identifiers: List[str] = []) -> List[Agent]:
        agents = await Agent.find_many(
            Agent.u_id == str(self._auth.get_user().id)
        ).to_list()
        for prebuilt_agent in [Agent.prebuilt(pt) for pt in list(PrebuiltAgents)]:
            if all(agent.identifier != prebuilt_agent.identifier for agent in agents):
                prebuilt_agent.u_id = str(self._auth.get_user().id)
                agents.append(prebuilt_agent)
        if len(identifiers) == 0:
            return agents
        else:
            # Check if all requested identifiers exist
            available_identifiers = {agent.identifier for agent in agents}
            missing_identifiers = set(identifiers) - available_identifiers
            if missing_identifiers:
                raise HTTPException(
                    status_code=404,
                    detail=f"Agents not found: {', '.join(missing_identifiers)}",
                )
            return [agent for agent in agents if agent.identifier in identifiers]

    async def get_org_agents(self, identifiers: List[str] = []) -> List[Agent]:
        agents = await Agent.find_many(
            Agent.org_id == str(self._auth.get_user().org_id)
        ).to_list()
        for prebuilt_agent in [Agent.prebuilt(pt) for pt in list(PrebuiltAgents)]:
            if all(agent.identifier != prebuilt_agent.identifier for agent in agents):
                prebuilt_agent.org_id = str(self._auth.get_user().org_id)
                agents.append(prebuilt_agent)
        if len(identifiers) == 0:
            return agents
        else:
            # Check if all requested identifiers exist
            available_identifiers = {agent.identifier for agent in agents}
            missing_identifiers = set(identifiers) - available_identifiers
            if missing_identifiers:
                raise HTTPException(
                    status_code=404,
                    detail=f"Agents not found: {', '.join(missing_identifiers)}",
                )
            return [agent for agent in agents if agent.identifier in identifiers]


class AgentResolver:
    def __init__(self, auth: AuthProvider, model_llm):
        self.model_llm = model_llm or get_llm()
        self._auth = auth

    async def resolve(self, agents: List[Agent]) -> CompiledStateGraph:
        mcp_client_service = MCPClientService(self._auth)

        if len(agents) == 1:
            # Single-agent mode: the agent is responsible for both saving and
            # retrieving long-term knowledge-graph memories.
            mcp_tools = await mcp_client_service.get_agent_tools(agents[0])
            tools = mcp_tools + [save_memory, search_memory]
            single_agent_prompt = (
                agents[0].system_prompt or ""
            ) + MEMORY_SINGLE_AGENT_GUIDANCE
            return create_react_agent(
                name=agents[0].name,
                model=self.model_llm,
                tools=tools,
                prompt=single_agent_prompt,
                checkpointer=get_mongo_checkpointer(),
                store=get_mongo_memory_store(),
                state_schema=AgentState,
                pre_model_hook=AgentHooks.pre_agent_hook,
                post_model_hook=AgentHooks.post_agent_hook,
            )
        else:
            if len(agents) == 0:
                agents = [
                    Agent.prebuilt(prebuilt_type=prebuilt_type)
                    for prebuilt_type in list(PrebuiltAgents)
                ]
            # Multi-agent mode:
            #   • Supervisor is responsible for saving memories (save + search).
            #   • Sub-agents can only retrieve memories (search only).
            #   • All agents share the same organisation-scoped knowledge graph.
            sub_agents = [
                create_react_agent(
                    name=agent.name,
                    model=self.model_llm,
                    tools=(await mcp_client_service.get_agent_tools(agent))
                    + [search_memory],
                    prompt=(agent.system_prompt or "") + MEMORY_SUB_AGENT_GUIDANCE,
                    store=get_mongo_memory_store(),
                    state_schema=AgentState,
                    pre_model_hook=AgentHooks.pre_agent_hook,
                    post_model_hook=AgentHooks.post_agent_hook,
                )
                for agent in agents
            ]
            return create_supervisor(
                supervisor_name="SuperAgent",
                agents=sub_agents,  # type: ignore[arg-type]  # CompiledStateGraph is a Pregel subtype
                model=self.model_llm,
                prompt=super_agent_prompt,
                tools=[save_memory, search_memory],
                add_handoff_messages=False,
                add_handoff_back_messages=False,
                state_schema=AgentState,
                pre_model_hook=AgentHooks.pre_agent_hook,
                post_model_hook=AgentHooks.post_agent_hook,
                output_mode="full_history",
            ).compile(checkpointer=get_mongo_checkpointer())
