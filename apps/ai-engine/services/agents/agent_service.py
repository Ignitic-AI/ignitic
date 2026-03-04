import asyncio
from typing import AsyncGenerator, List, TypedDict
from models.agent import Agent
from services.agents.agent_resolver import AgentResolver
from services.agents.llms import get_llm
from services.agents.checkpointers import (
    isCheckpointerLastMessageEqualTo,
)
from models.agent import PrebuiltAgents
from core.auth import AuthProvider
from fastapi import HTTPException
from langchain_core.runnables import RunnableConfig
from models.custom_messages import ImageMessage, FileMessage
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
            messages.append({"role": "user", "content": message})
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

                                        logger.debug(
                                            f"📤 Streaming chunk #{chunk_index}: {len(emit_content)} chars, agent={agent_name}"
                                        )
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
                    logger.debug(
                        f"📤 Streaming final chunk #{chunk_index}: {len(buffer)} chars (remaining buffer)"
                    )
                    yield {
                        "chunk_index": chunk_index,
                        "content": buffer,
                        "is_final": True,
                        "agent_name": agents[0].name
                        if len(agents) == 1
                        else "Assistant",
                    }
                elif chunk_index > 0:
                    logger.debug(
                        f"📤 Streaming final empty chunk #{chunk_index} (mark EOS after {chunk_index} chunks)"
                    )
                    # If we emitted chunks but buffer is empty, mark the last one as final
                    # This case is handled by updating the last yield
                    yield {
                        "chunk_index": chunk_index,
                        "content": "",
                        "is_final": True,
                        "agent_name": agents[0].name
                        if len(agents) == 1
                        else "Assistant",
                    }
                else:
                    # No content was generated
                    logger.warning(f"⚠️  No content generated from stream")
                    yield {
                        "chunk_index": 0,
                        "content": "",
                        "is_final": True,
                        "agent_name": agents[0].name
                        if len(agents) == 1
                        else "Assistant",
                    }

                # Success - break out of retry loop
                # Persist the full message history to DB so summarisation does
                # not affect what the frontend reads back via get_chat_messages.
                try:
                    from services.agents.chat_service import ChatService

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
                    }
                    return

                await asyncio.sleep(delay)
                delay = min(delay * 2, MAX_DELAY)

                # Reset state for retry
                chunk_index = 0
                buffer = ""

    async def astream_agents_v2(
        self,
        agents: List[Agent],
        message: str,
        thread_id: str,
        chat_id: str,
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
        agent = await AgentResolver(model_llm=effective_llm, auth=self._auth).resolve(
            agents
        )

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
