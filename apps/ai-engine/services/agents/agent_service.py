import asyncio
import json
import uuid
from typing import Any, AsyncGenerator, List, TypedDict
from models.agent import Agent
from services.agents.agent_resolver import AgentResolver
from services.agents.llms import get_llm
from services.agents.checkpointers import (
    resolve_agent_name_from_event,
    isCheckpointerLastMessageEqualTo,
)
from models.agent import PrebuiltAgents
from core.auth import AuthProvider
from fastapi import HTTPException
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig
from models.custom_messages import ImageMessage, FileMessage
from services.agents.chat_service import ChatService
from loguru import logger
import aiohttp


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

                                doc_name = (
                                    filename
                                    if "." in filename
                                    else f"document_{index + 1}"
                                )
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
                            logger.error(
                                f"Failed to parse with MarkItDown for {url}: {parse_err}"
                            )
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
                    "filename": filename if "." in filename else f"file_{index + 1}",
                },
            },
        ]
    )


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

    async def ainvoke_agents(
        self,
        agents: List[Agent],
        message: str,
        thread_id: str,
        chat_id: str,
        model: str | None = None,
        image_urls: list[str] | None = None,
        file_urls: list[str] | None = None,
    ):
        effective_llm = get_llm(model)
        agent = await AgentResolver(model_llm=effective_llm, auth=self._auth).resolve(
            agents
        )

        RETRY_COUNT = 3
        INITIAL_DELAY = 1  # seconds
        MAX_DELAY = 10  # seconds

        delay = INITIAL_DELAY
        agent_response = None

        # Build input_data ONCE before the retry loop so that every attempt
        # reuses the same message objects (same LangChain message IDs).
        # If we rebuilt the list on each retry, each attempt would create a
        # fresh HumanMessage with a new unique ID, causing add_messages to
        # append a duplicate message to the checkpointed state rather than
        # updating the existing one.
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
                                {
                                    "type": "image_url",
                                    "image_url": {"url": url},
                                },
                            ]
                        )
                    )
            if file_urls:
                for i, url in enumerate(file_urls):
                    file_msg = await _process_file_url(url, i)
                    messages.append(file_msg)
            # Use an explicit HumanMessage with a stable ID so that every retry
            # reuses the same message identity. A plain dict gets converted to a
            # new HumanMessage with a fresh random ID on each attempt, causing
            # add_messages to append duplicate entries to the checkpointer state.
            messages.append(HumanMessage(content=message, id=str(uuid.uuid4())))
            input_data = {"messages": messages}

        invoke_config: RunnableConfig = {
            "configurable": {
                "thread_id": thread_id,
                "u_id": self._auth.get_user().id,
                "org_id": self._auth.get_user().org_id,
                "chat_id": chat_id,
                "auth": self._auth.get_token(),
                "agents": [
                    {
                        "identifier": agent.identifier,
                        "name": agent.name,
                    }
                    for agent in agents
                ],
            }
        }

        while agent_response is None and RETRY_COUNT > 0:
            try:
                agent_response = await agent.ainvoke(input_data, config=invoke_config)
            except Exception as e:
                RETRY_COUNT -= 1
                if RETRY_COUNT == 0:
                    raise Exception(f"Agent failed: {str(e)}")
                await asyncio.sleep(delay)
                delay = min(delay * 2, MAX_DELAY)  # Exponential backoff
        if agent_response is None:
            raise Exception("Agent failed after retries")

        # Persist the full message history to the DB so that summarisation
        # by the SummarizationNode does not corrupt what the frontend reads.
        try:
            from services.agents.chat_service import ChatService

            messages = list(agent_response.get("messages") or [])
            if messages:
                await ChatService(auth=self._auth).save_chat_messages(chat_id, messages)
        except Exception as persist_err:
            logger.warning(
                f"⚠️  Failed to persist chat messages for chat {chat_id}: {persist_err}"
            )

        return agent_response

    class AgentStreamResponseChunk(TypedDict):
        chunk_index: int
        content: str
        is_final: bool
        agent_name: str
        chunk_type: str  # "text" | "tool_call" | "tool_result"
        tool_name: str  # populated for tool_call / tool_result chunks
        tool_args: dict  # populated for tool_call chunks
        tool_output: Any  # populated for tool_result chunks

    async def astream_agents(
        self,
        agents: List[Agent],
        message: str,
        thread_id: str,
        chat_id: str,
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

        logger.info(
            f"Starting agent stream: thread_id={thread_id}, chat_id={chat_id}, agents={[agent.name for agent in agents]}, model={model}"
            f", image_urls={image_urls}, file_urls={file_urls}"
        )

        effective_llm = get_llm(model)
        agent = await AgentResolver(model_llm=effective_llm, auth=self._auth).resolve(
            agents
        )

        RETRY_COUNT = 3
        INITIAL_DELAY = 1  # seconds
        MAX_DELAY = 10  # seconds

        delay = INITIAL_DELAY
        chunk_index = 0

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
            # Use an explicit HumanMessage with a stable ID — same reason as
            # ainvoke_agents: dicts produce a new random ID on every retry,
            # causing the checkpointer to accumulate duplicate HumanMessages.
            stream_messages.append(HumanMessage(content=message, id=str(uuid.uuid4())))
            input_data = {"messages": stream_messages}

        config: RunnableConfig = {
            "configurable": {
                "thread_id": thread_id,
                "u_id": self._auth.get_user().id,
                "org_id": self._auth.get_user().org_id,
                "chat_id": chat_id,
                "auth": self._auth.get_token(),
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
            # Track whether the summarize node's LLM was actually invoked this
            # iteration.  Reset per retry so a failed attempt doesn't pollute
            # the next one.
            _summarize_llm_called = False
            _last_agent_name = None

            try:
                # Use astream_events for detailed streaming
                async for event in agent.astream_events(
                    input_data, config=config, version="v2"
                ):
                    event_type = event["event"]
                    node = event.get("metadata", {}).get("langgraph_node") or event.get(
                        "name", ""
                    )
                    agent_name = resolve_agent_name_from_event(event, agents)

                    if agent_name != _last_agent_name:
                        logger.debug(f"Agent switched: {agent_name} (node: {node})")
                        _last_agent_name = agent_name

                    # ----------------------------------------------------------
                    # Text tokens
                    # ----------------------------------------------------------
                    if event_type == "on_chat_model_stream":
                        # Suppress tokens produced by the summarize node itself.
                        # These are internal to langmem's SummarizationNode and
                        # must NOT be forwarded to the client as chat text.
                        # We also use the first such token as the trigger to emit
                        # a summarize_start signal so the client is notified only
                        # when an actual new summary is being generated.

                        if node == "summarize":
                            if not _summarize_llm_called:
                                _summarize_llm_called = True
                                logger.debug(
                                    "🗜  Summarization LLM invoked — emitting summarize_start"
                                )
                                yield {
                                    "chunk_index": chunk_index,
                                    "content": "",
                                    "is_final": False,
                                    "agent_name": "System",
                                    "chunk_type": "summarize_start",
                                    "tool_name": "",
                                    "tool_args": {},
                                    "tool_output": None,
                                }
                                chunk_index += 1
                            continue  # always skip summarize tokens

                        chunk_content = ""

                        # Handle different chunk structures
                        data = event.get("data", {})
                        chunk = data.get("chunk")

                        if chunk:
                            if hasattr(chunk, "content"):
                                chunk_content = chunk.content
                            elif isinstance(chunk, dict) and "content" in chunk:
                                chunk_content = chunk["content"]

                        # Yield every token immediately – no buffering.
                        if chunk_content:
                            logger.debug(
                                f"📤 Streaming chunk #{chunk_index}: {len(chunk_content)} chars, agent={agent_name}"
                            )
                            yield {
                                "chunk_index": chunk_index,
                                "content": chunk_content,
                                "is_final": False,
                                "agent_name": agent_name,
                                "chunk_type": "text",
                                "tool_name": "",
                                "tool_args": {},
                                "tool_output": None,
                            }
                            chunk_index += 1

                    # ----------------------------------------------------------
                    # Summarization node lifecycle
                    # summarize_start is emitted on the first on_chat_model_stream
                    # token from the summarize node (above), so we know the LLM
                    # is actually generating a new summary.  Here we only reset
                    # state on chain start and decide whether to emit summarize_end
                    # on chain end.
                    # ----------------------------------------------------------
                    elif event_type == "on_chain_start":
                        if node == "summarize":
                            logger.debug("🗜  Summarization node started")
                            _summarize_llm_called = False  # reset for this run

                    elif event_type == "on_chain_end":
                        if node == "summarize":
                            if not _summarize_llm_called:
                                # The node ran but the LLM was never invoked —
                                # it simply reinjected the existing rolling
                                # summary without generating anything new.  No
                                # signal is needed.
                                logger.debug(
                                    "🗜  Summarization node finished (no new summary "
                                    "generated — rolling summary reinjected only)"
                                )
                            else:
                                # A new summary was generated.  Extract its text
                                # from the node's output state and emit the end
                                # signal so the client can display it.
                                output = event.get("data", {}).get("output") or {}
                                summary_text = ""
                                if isinstance(output, dict):
                                    for msg in output.get("summarized_messages") or []:
                                        if isinstance(msg, dict):
                                            content = msg.get("content", "")
                                            msg_type = msg.get("type", "")
                                        else:
                                            content = getattr(msg, "content", "") or ""
                                            msg_type = getattr(msg, "type", "") or ""
                                        if msg_type == "system" and content:
                                            # Strip the boilerplate prefix added
                                            # by langmem before the real summary.
                                            prefix = (
                                                "Summary of the conversation so far:"
                                            )
                                            if content.startswith(prefix):
                                                content = content[len(prefix) :].strip()
                                            summary_text = content
                                            break
                                logger.debug(
                                    f"🗜  Summarization node finished (new summary generated), "
                                    f"summary_len={len(summary_text)}"
                                )
                                yield {
                                    "chunk_index": chunk_index,
                                    "content": summary_text,
                                    "is_final": False,
                                    "agent_name": "System",
                                    "chunk_type": "summarize_end",
                                    "tool_name": "",
                                    "tool_args": {},
                                    "tool_output": None,
                                }
                                chunk_index += 1

                    # ----------------------------------------------------------
                    # Tool invocation started
                    # ----------------------------------------------------------
                    elif event_type == "on_tool_start":
                        tool_name = event.get("name", "unknown_tool")
                        tool_input = event.get("data", {}).get("input") or {}
                        if isinstance(tool_input, str):
                            tool_input = {"input": tool_input}
                        # Ensure every value is JSON-serialisable
                        try:
                            safe_args = json.loads(json.dumps(tool_input, default=str))
                        except Exception:
                            safe_args = (
                                {k: str(v) for k, v in tool_input.items()}
                                if isinstance(tool_input, dict)
                                else {}
                            )

                        logger.debug(
                            f"🔧 Tool call: {tool_name}({safe_args}), agent={agent_name}"
                        )
                        yield {
                            "chunk_index": chunk_index,
                            "content": "",
                            "is_final": False,
                            "agent_name": agent_name,
                            "chunk_type": "tool_call",
                            "tool_name": tool_name,
                            "tool_args": safe_args,
                            "tool_output": None,
                        }
                        chunk_index += 1

                    # ----------------------------------------------------------
                    # Tool invocation finished
                    # ----------------------------------------------------------
                    elif event_type == "on_tool_end":
                        tool_name = event.get("name", "unknown_tool")
                        tool_output = event.get("data", {}).get("output")

                        # Make tool output safe to stream over JSON transports.
                        try:
                            safe_output = json.loads(
                                json.dumps(tool_output, default=str)
                            )
                        except Exception:
                            safe_output = str(tool_output)

                        logger.debug(f"✅ Tool done: {tool_name}, agent={agent_name}")
                        logger.debug(f"✅ Tool end event={event}")

                        yield {
                            "chunk_index": chunk_index,
                            "content": "",
                            "is_final": False,
                            "agent_name": agent_name,
                            "chunk_type": "tool_result",
                            "tool_name": tool_name,
                            "tool_args": {},
                            "tool_output": safe_output,
                        }
                        chunk_index += 1

                # Final sentinel so the client knows the stream is done
                logger.debug(f"📤 Stream complete: {chunk_index} token chunks emitted")
                yield {
                    "chunk_index": chunk_index,
                    "content": "",
                    "is_final": True,
                    "agent_name": _last_agent_name or "Assisstant",
                    "chunk_type": "text",
                    "tool_name": "",
                    "tool_args": {},
                    "tool_output": None,
                }

                # Success - break out of retry loop
                # Persist the full message history to DB so summarisation does
                # not affect what the frontend reads back via get_chat_messages.
                try:
                    state = await agent.aget_state(config)
                    persisted_messages = list(
                        (state.values or {}).get("messages") or []
                    )
                    if persisted_messages:
                        await ChatService(auth=self._auth).save_chat_messages(
                            chat_id, persisted_messages
                        )
                except Exception as persist_err:
                    logger.warning(
                        f"⚠️  Failed to persist chat messages for chat "
                        f"{chat_id} after stream: {persist_err}"
                    )

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
                        "chunk_type": "text",
                        "tool_name": "",
                        "tool_args": {},
                        "tool_output": None,
                    }
                    return

                await asyncio.sleep(delay)
                delay = min(delay * 2, MAX_DELAY)

                # Reset state for retry
                chunk_index = 0
