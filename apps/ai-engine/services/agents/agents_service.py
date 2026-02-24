import asyncio
import json
from datetime import datetime
from typing import Annotated, Any, AsyncGenerator, List, NotRequired, TypedDict
from langgraph.managed import RemainingSteps
from langgraph_supervisor import create_supervisor
from models.agent import Agent
from models.analytics import AgentRun
from services.agents.llms import get_llm
from services.agents.prompts import super_agent_prompt
from services.agents.checkpointers import (
    get_mongo_checkpointer,
    isCheckpointerLastMessageEqualTo,
)
from services.agents.memory_stores import get_mongo_memory_store
from langgraph.graph.state import CompiledStateGraph, Sequence
from langgraph.prebuilt import create_react_agent
from models.chat import PrebuiltAgents
from services.agents.mcp_client import MCPClientService
from models.context_message import ContextMessage
from core.auth import AuthProvider
from models.user import User
from services.mongo_vector_store_service import VectorStoreService
from services.organization_service import OrganizationService
from fastapi import HTTPException
from langgraph.graph import add_messages
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    ToolMessage,
)
from langchain_core.runnables import RunnableConfig
from langgraph.store.base import BaseStore
from loguru import logger


async def ainvoke_agents(
    agents: List[Agent],
    message: str,
    thread_id: str,
    chat_id: str,
    auth: AuthProvider,
    model: str | None = None,
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


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    remaining_steps: NotRequired[RemainingSteps]
    start_time: datetime


class AgentResolver:
    def __init__(self, auth: AuthProvider, model_llm):
        self.model_llm = model_llm or get_llm()
        self._auth = auth

    async def resolve(self, agents: List[Agent]) -> CompiledStateGraph:
        mcp_client_service = MCPClientService(self._auth)

        if len(agents) == 1:
            tools = await mcp_client_service.get_agent_tools(agents[0])
            return create_react_agent(
                name=agents[0].name,
                model=self.model_llm,
                tools=tools,
                prompt=agents[0].system_prompt,
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
            return create_supervisor(
                supervisor_name="SuperAgent",
                agents=[
                    create_react_agent(
                        name=agent.name,
                        model=self.model_llm,
                        tools=await mcp_client_service.get_agent_tools(agent),
                        prompt=agent.system_prompt,
                        store=get_mongo_memory_store(),
                        state_schema=AgentState,
                        pre_model_hook=AgentHooks.pre_agent_hook,
                        post_model_hook=AgentHooks.post_agent_hook,
                    )
                    for agent in agents
                ],
                model=self.model_llm,
                prompt=super_agent_prompt,
                add_handoff_messages=False,
                add_handoff_back_messages=False,
                state_schema=AgentState,
                pre_model_hook=AgentHooks.pre_agent_hook,
                post_model_hook=AgentHooks.post_agent_hook,
                output_mode="full_history",
            ).compile(checkpointer=get_mongo_checkpointer())


class AgentHooks:
    @staticmethod
    async def _memory_retreiver_hook(
        state: AgentState, config: RunnableConfig, store: BaseStore, **kwargs
    ) -> AgentState:
        """RAG: fetch relevant asset chunks and insert a ContextMessage before
        the current HumanMessage. Assumes last message is a HumanMessage.
        """
        last_message = state["messages"][-1]

        # Extract text query from the human message
        if isinstance(last_message.content, str):
            query = last_message.content
        elif isinstance(last_message.content, list):
            query = " ".join(
                block.get("text", "")
                for block in last_message.content
                if isinstance(block, dict) and block.get("type") == "text"
            )
        else:
            return state

        if not query.strip():
            return state

        configurable = config.get("configurable", {})
        u_id = configurable.get("u_id")
        auth_token = configurable.get("auth")

        if not u_id or not auth_token:
            logger.warning("⚠️ Missing u_id or auth token, skipping RAG")
            return state

        try:
            vector_service = VectorStoreService(AuthProvider.from_token(auth_token))
            chunks = await vector_service.search_asset_chunks(query=query, limit=5)

            if not chunks:
                return state

            context_parts = [
                f"[Relevant document chunk {i + 1}]:\n{chunk.content}"
                for i, chunk in enumerate(chunks)
            ]
            rag_content = (
                "<retrieved_context>\n"
                + "\n\n".join(context_parts)
                + "\n</retrieved_context>"
            )

            messages = list(state["messages"])
            # Insert ContextMessage immediately before the HumanMessage
            messages.insert(-1, ContextMessage(content=rag_content))
            state["messages"] = messages
            logger.info(
                f"🔍 RAG: inserted {len(chunks)} document chunks as ContextMessage"
            )

        except Exception as e:
            logger.warning(f"⚠️ Memory retriever hook failed, skipping RAG: {e}")

        return state

    @staticmethod
    async def _inject_system_context_hook(
        state: AgentState, config: RunnableConfig, store: BaseStore, **kwargs
    ) -> AgentState:
        """Insert a ContextMessage carrying user and org info before the current
        HumanMessage. Assumes last message is already confirmed to be a HumanMessage.
        """
        configurable = config.get("configurable", {})
        auth_token = configurable.get("auth")
        org_id = configurable.get("org_id")

        if not auth_token:
            logger.warning("⚠️ No auth token in config, skipping context injection")
            return state

        try:
            auth = AuthProvider.from_token(auth_token)
            user = auth.get_user()

            user_block = (
                f"<user_info>\n"
                f"Name: {user.name or 'N/A'}\n"
                f"Email: {user.email}\n"
                f"</user_info>"
            )

            org_block = ""
            if org_id:
                try:
                    org = await OrganizationService(auth).get_organization(org_id)
                    parts = [f"Name: {org.name}"]
                    if org.industry:
                        parts.append(f"Industry: {org.industry}")
                    if org.description:
                        parts.append(f"Description: {org.description}")
                    if org.company_size:
                        parts.append(f"Company size: {org.company_size}")
                    if org.country:
                        parts.append(f"Country: {org.country}")
                    if org.subscription_plan:
                        parts.append(f"Plan: {org.subscription_plan}")
                    if org.user_role:
                        parts.append(f"User role: {org.user_role}")
                    org_block = "\n<org_info>\n" + "\n".join(parts) + "\n</org_info>"
                except Exception as org_err:
                    logger.warning(f"⚠️ Failed to fetch org context: {org_err}")

            context_content = (
                f"<injected_context>\n{user_block}{org_block}\n</injected_context>"
            )

            messages = list(state["messages"])
            # Insert ContextMessage immediately before the HumanMessage
            messages.insert(-1, ContextMessage(content=context_content))
            state["messages"] = messages
            logger.info(
                f"👤 Inserted user/org ContextMessage for {user.email}"
                + (f" / org {org_id}" if org_id else "")
            )

        except Exception as e:
            logger.warning(f"⚠️ Context injection failed, skipping: {e}")

        return state

    @staticmethod
    async def _agent_run_log_hook(
        state: AgentState, config: RunnableConfig, store: BaseStore, **kwargs
    ) -> AgentState:
        last_message = state["messages"][-1]

        if not isinstance(last_message, AIMessage):
            return state  # Only log AIMessage types

        configurable = config.get("configurable", {})

        u_id = configurable.get("u_id")
        org_id = configurable.get("org_id")
        thread_id = configurable.get("thread_id")
        chat_id = configurable.get("chat_id")
        agents = configurable.get("agents", [])
        started_at = state["start_time"]

        if not u_id:
            raise ValueError("u_id is required in configurable for logging agent runs")

        if not thread_id:
            raise ValueError(
                "thread_id is required in configurable for logging agent runs"
            )

        if not chat_id:
            raise ValueError(
                "chat_id is required in configurable for logging agent runs"
            )

        metadata = getattr(last_message, "response_metadata", {})
        token_usage = metadata.get("token_usage", {})

        input_tokens = token_usage.get("prompt_tokens", 0)
        output_tokens = token_usage.get("completion_tokens", 0)
        total_tokens = token_usage.get("total_tokens", 0)

        total_cost_usd = token_usage.get("cost", 0.0)

        if not started_at:
            logger.debug(
                "No start time found in config, using current time for both start and end"
            )
            started_at = datetime.now()
        ended_at = datetime.now()
        duration_ms = int((ended_at - started_at).total_seconds() * 1000)

        try:
            agent_run = AgentRun(
                agent_identifier=next(
                    (
                        agent["identifier"]
                        for agent in agents
                        if agent["name"] == last_message.name
                    ),
                    "super_agent",
                ),
                agent_name=last_message.name or "Assisstant",
                u_id=u_id,
                org_id=org_id,
                chat_id=chat_id,
                thread_id=thread_id,
                message_id=last_message.id,
                tool_calls=[tc["id"] for tc in getattr(last_message, "tool_calls", [])],
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                model_used=last_message.response_metadata.get("model_name", "unknown"),
                started_at=started_at,
                ended_at=ended_at,
                duration_ms=duration_ms,
                created_at=started_at,
                cost=total_cost_usd,
            )

            await agent_run.insert()

        except Exception as e:
            print(f"Failed to log agent run: {e}")

        return state

    @staticmethod
    def _is_injected_image_human_message(msg: BaseMessage) -> bool:
        """Returns True if this is a HumanMessage that was injected by us to carry image content."""
        return (
            isinstance(msg, HumanMessage)
            and isinstance(msg.content, list)
            and any(
                isinstance(block, dict) and block.get("type") == "image_url"
                for block in msg.content
            )
        )

    @staticmethod
    def _convert_image_tool_messages(state: AgentState) -> AgentState:
        """
        Scans ToolMessages for MCP image responses and makes them visible to
        vision-capable models.

        The OpenAI/OpenRouter API only supports multimodal content in user-role
        messages (HumanMessage). ToolMessages are restricted to plain text.
        Therefore we:
          1. Replace the image ToolMessage content with a short text placeholder.
          2. Inject a HumanMessage immediately after carrying the actual image
             content as an image_url block (data URI), which is the format
             supported by OpenAI-compatible vision APIs.

        This hook is idempotent: if a ToolMessage has already been processed
        (i.e. the next message is already an injected image HumanMessage),
        it is left untouched to avoid duplicating messages across invocations.

        Expected MCP image JSON format:
            {"type": "image", "base64": "...", "mime_type": "image/png", "name": "..."}
        """
        messages = state["messages"]
        new_messages = []
        for i, msg in enumerate(messages):
            if isinstance(msg, ToolMessage) and isinstance(msg.content, str):
                try:
                    data = json.loads(msg.content)
                    if (
                        isinstance(data, dict)
                        and data.get("type") == "image"
                        and "base64" in data
                    ):
                        # Check if the next message is already an injected HumanMessage
                        # (idempotency guard — prevents re-injection on every hook call)
                        next_msg = messages[i + 1] if i + 1 < len(messages) else None
                        if next_msg and AgentHooks._is_injected_image_human_message(
                            next_msg
                        ):
                            new_messages.append(msg)
                            continue

                        mime_type = data.get("mime_type", "image/png")
                        base64_data = data["base64"]
                        file_name = data.get("name", "image")

                        # Replace ToolMessage with a text-only placeholder
                        placeholder_msg = ToolMessage(
                            content=f"[Image file retrieved: {file_name}. The image content is provided in the following message.]",
                            tool_call_id=msg.tool_call_id,
                            name=msg.name,
                            id=msg.id,
                        )
                        new_messages.append(placeholder_msg)

                        # Inject a HumanMessage with the actual image for the model to see
                        image_msg = HumanMessage(
                            content=[
                                {
                                    "type": "text",
                                    "text": f"Here is the image content of '{file_name}':",
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:{mime_type};base64,{base64_data}"
                                    },
                                },
                            ]
                        )
                        new_messages.append(image_msg)
                        logger.debug(f"Injected image HumanMessage for '{file_name}'")
                        continue
                except (json.JSONDecodeError, AttributeError, TypeError):
                    pass
            new_messages.append(msg)
        state["messages"] = new_messages
        return state

    @staticmethod
    async def pre_agent_hook(
        state: AgentState, config: RunnableConfig, store: BaseStore, **kwargs
    ) -> AgentState:
        state["start_time"] = datetime.now()
        state = AgentHooks._convert_image_tool_messages(state)

        # Both enrichment hooks target the HumanMessage and are naturally idempotent:
        # during tool loops the last message is a ToolMessage, not HumanMessage,
        # so these only fire once per user turn.
        if state["messages"] and isinstance(state["messages"][-1], HumanMessage):
            state = await AgentHooks._inject_system_context_hook(
                state, config, store, **kwargs
            )
            state = await AgentHooks._memory_retreiver_hook(
                state, config, store, **kwargs
            )

        return state

    @staticmethod
    async def post_agent_hook(
        state: AgentState, config: RunnableConfig, store: BaseStore, **kwargs
    ) -> AgentState:
        state = await AgentHooks._agent_run_log_hook(state, config, store, **kwargs)
        return state
