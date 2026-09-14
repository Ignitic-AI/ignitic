import json
import os
from datetime import datetime
from models.agent import AgentState
from models.analytics import AgentRun
from models.custom_messages import ContextMessage, ImageMessage, FileMessage
from core.auth import AuthProvider
from services.mongo_vector_store_service import VectorStoreService
from services.organization_service import OrganizationService
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    ToolMessage,
)
from langchain_core.runnables import RunnableConfig
from langgraph.store.base import BaseStore
from loguru import logger


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
            chunks = await vector_service.search_asset_chunks(query=query, limit=2)

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
            human_msg_id = getattr(messages[-1], "id", None) if messages else None
            # Insert ContextMessage immediately before the HumanMessage
            messages.insert(-1, ContextMessage(
                content=rag_content,
                additional_kwargs={"human_message_id": human_msg_id} if human_msg_id else {},
            ))
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
            human_msg_id = getattr(messages[-1], "id", None) if messages else None
            # Insert ContextMessage immediately before the HumanMessage
            messages.insert(-1, ContextMessage(
                content=context_content,
                additional_kwargs={"human_message_id": human_msg_id} if human_msg_id else {},
            ))
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
            agent_identifier = last_message.name or "super_agent"
            agent_display_name = next(
                (
                    agent["name"]
                    for agent in agents
                    if agent["identifier"] == agent_identifier
                ),
                agent_identifier,
            )
            agent_run = AgentRun(
                agent_identifier=agent_identifier,
                agent_name=agent_display_name,
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
        """Returns True if this message was injected by us to carry image content."""
        return isinstance(msg, ImageMessage)

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

        If VISION_CAPABLE is not set to 'true' in the environment, no image_url
        is injected and a text notice is shown instead, preventing 404 errors
        from vision-incapable models (e.g. GLM, smaller open-weights models).

        This hook is idempotent: if a ToolMessage has already been processed
        (i.e. the next message is already an injected image HumanMessage),
        it is left untouched to avoid duplicating messages across invocations.

        Expected MCP image JSON format:
            {"type": "image", "base64": "...", "mime_type": "image/png", "name": "..."}
        """
        vision_capable = os.getenv("VISION_CAPABLE", "true").lower() == "true"

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

                        if vision_capable:
                            # Inject an ImageMessage with the actual image for
                            # vision-capable models (e.g. GPT-4o, Gemini).
                            image_msg = ImageMessage(
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
                            logger.debug(
                                f"Injected image HumanMessage for '{file_name}'"
                            )
                        else:
                            # Model does not support vision — inject a text-only
                            # notice so the agent can respond gracefully instead
                            # of crashing with a 404 from the API.
                            notice_msg = ImageMessage(
                                content=(
                                    f"[Image '{file_name}' was retrieved but the current model "
                                    f"does not support image input. "
                                    f"Set VISION_CAPABLE=true in your .env and use a vision-capable model "
                                    f"(e.g. openai/gpt-4o, google/gemini-2.0-flash) to analyze images.]"
                                )
                            )
                            new_messages.append(notice_msg)
                            logger.warning(
                                f"⚠️  Image '{file_name}' skipped — VISION_CAPABLE is not set to true. "
                                "Text placeholder injected instead."
                            )
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

        # Fire enrichment hooks only on a fresh user turn.
        # Globally idempotent: we tag each injected ContextMessage with the
        # HumanMessage ID it belongs to, then scan the ENTIRE message array
        # (not just msgs[-2]) to avoid duplicate injection when Intent
        # Teleportation re-enters the subgraph across multiple turns.
        msgs = state["messages"]
        if msgs:
            last = msgs[-1]
            if last.type == "human":
                human_msg_id = getattr(last, "id", None)

                # Check if context was already injected for THIS HumanMessage
                already_injected = False
                if human_msg_id:
                    for m in msgs:
                        if isinstance(m, ContextMessage):
                            if m.additional_kwargs.get("human_message_id") == human_msg_id:
                                already_injected = True
                                break

                if not already_injected:
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


