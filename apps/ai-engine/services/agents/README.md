# Agents Service Architecture & Documentation

The `agents/` service directory is the core of the Ignitic AI Engine's conversational, autonomous, and multi-agent behavior. It heavily leverages **LangChain** and **LangGraph** to build highly capable, stateful, and context-aware agent networks. 

This README provides an in-depth breakdown of how the agent network is constructed, how it executes, how memory and context are handled, and how Model Context Protocol (MCP) tools are integrated.

---

## 1. Multi-Agent Architecture & Network Topology

The system uses `LangGraph` to orchestrate either single-agent workflows or complex hierarchical multi-agent networks. This logic resides primarily in `agent_resolver.py` and implements a **State-Encapsulated Supervisor Pattern with Intent Teleportation**.

### Hierarchical StateGraph Construction
If multiple agents are active in a conversation, the engine dynamically builds a hierarchical `StateGraph`.
- **Super Agent Root**: A root `super_agent` node is created. It doesn't perform tasks directly but acts as a router and orchestrator, delegating tasks to child agents.
- **State Encapsulation**: Sub-agents encapsulate their internal scratchpads and tool calls. When transferring control, they pass synthetic handoff records rather than flushing their full internal state to the parent, significantly reducing token bloat.
- **Handoff / Transfer Tools**: Agents move control between each other using dynamic LangChain `@tool` instances.
  - `transfer_to_<agent>`: Used by the `super_agent` to delegate tasks to a specific child agent.
  - `transfer_back_to_parent`: The "escape hatch" called by a sub-agent when the user's request is completely outside its domain. It immediately returns control to the `super_agent` for re-routing, without producing text output.

### The Agent Graph Nodes
The compiled graph consists of:
1. **`summarize`**: A LangMem `SummarizationNode` that runs *first* on every turn to prevent context bloat.
2. **`router_node`**: Responsible for determining which agent holds control based on the `active_agent` state. It implements **Intent Teleportation** using a fast, domain-aware LLM classifier to determine if the user's new message continues the conversation within the previous agent's domain, teleporting them directly back to that agent and bypassing the `super_agent`.
3. **Agent Nodes**: A distinct node (created via `create_react_agent`) for the `super_agent` and each requested child agent.

---

## 2. Execution and Streaming Workflow

The primary entry point for agent inference is the `AgentService` (`agent_service.py`), which manages resilient execution and chunked streaming to the frontend.

1. **Context Initialization**: 
   When `astream_agents` is called, user inputs (`HumanMessage`) are pre-seeded into the event stream collection. The system processes uploaded file URLs and images, parsing documents into a `FileMessage`.
2. **Graph Resolution**:
   `AgentResolver` builds or retrieves the compiled LangGraph based on the requested agents and binds the resolved LLM provider (`get_llm`).
3. **Execution & Event Streaming**:
   The `astream_events` method of LangGraph is called. The execution stream intercepts events (version="v2") and yields chunks to the client:
   - `on_chat_model_stream`: Emits actual LLM text tokens. It filters out "orchestration noise" by suppressing tokens generated internally by infrastructure nodes like `summarize` and `router_node`.
   - `on_tool_start` / `on_tool_end`: Intercepts tool executions, serializing the arguments and results safely, and notifies the client of tool usage in real-time.
   - `summarize_start` / `summarize_end`: Signals when the system is updating its internal memory.

---

## 3. Context Management, Memory, and Persistence

The agent system is designed to handle very long contexts gracefully without crashing the LLM context window.

### Graphiti & Long-Term Memory
- Global long-term semantic memory is managed through Graphiti. Tools like `save_memory` and `search_memory` (in `tools/graphiti_memory_tools.py`) are injected into the agent's context, allowing the agent to remember facts across completely different chat sessions.

### Short-Term Memory & Summarization
- Inside `agent_resolver.py`, a `SummarizationNode` monitors the token count of the current conversation. 
- When the history exceeds `MAX_TOKENS_BEFORE_SUMMARY` (e.g., 20000 tokens), it invokes a summarization LLM to compress the oldest messages into a system summary.
- The `router_node` cleanly handles injecting this summary into the LangGraph state. It generates fresh UUIDs for the summarized messages so LangGraph's `add_messages` reducer accurately clears out the old context and prepends the new `SystemMessage` summary, preserving chronological order.

### Event-Stream Chat Persistence (`ChatService`)
- While LangGraph maintains the compressed state via its checkpointer (MongoDB), the `ChatService` saves the actual uncompressed chat history by collecting event streams during execution.
- The system filters out "orchestration noise" (e.g., `transfer_to_...` internal tool calls) from the database log via `_is_orchestration_noise()`, keeping the persistent UI history clean and completely decoupled from the volatile LangGraph checkpoint state.

### System & Network Context Injections (`agent_hooks.py` & `agent_resolver.py`)
- **Agent Network Context**: During graph compilation (`agent_resolver.py`), each sub-agent receives an injected `AGENT NETWORK CONTEXT` block in its system prompt, giving it identity, domain awareness, and explicit escalation instructions via `transfer_back_to_parent`.
- **System Context Hook**: `_inject_system_context_hook` injects a context block containing details about the current User and Organization (Industry, Size, Role) and ensures global idempotency using the `human_message_id`.
- **RAG Hook**: `_memory_retreiver_hook` fetches relevant vector database chunks and injects them as a `ContextMessage`.
- **Vision Model Support**: `_convert_image_tool_messages` makes MCP image responses visible to vision-capable models by replacing ToolMessage contents and injecting a formatted `HumanMessage`.

---

## 4. MCP Tools Connection

The engine natively speaks the Model Context Protocol (MCP) to interact with external microservices and tools via `mcp_client.py`.

### MultiServerMCPClient
- The `MCPClientService` initializes a `MultiServerMCPClient`.
- It creates individual server connections over HTTP streaming (`streamable_http`) for each prebuilt agent and a general `custom` server.
- The connection attaches vital context headers: `Authorization`, `X-Chat-ID`, and `X-Image-URLs`.

### Tool Caching and Filtering
- **Caching**: The MCP Client implements a 10-minute in-memory TTL cache (`_TOOLS_CACHE`) for tool definitions.
- **Agent Allowlisting**: After fetching tools, `_filter_tools_for_agent` ensures that a custom agent only receives the specific tools it was explicitly authorized to use.

---

## 5. Adding and Extending Features

To expand the capabilities of this network:
1. **Local Tools**: Create a new file in `services/agents/tools/`, use the LangChain `@tool` decorator, and ensure strict type-hinting and docstrings. Import and append the tool inside `agent_resolver.py`.
2. **MCP Tools**: Add new capabilities to the external MCP server. The `MCPClientService` will dynamically fetch and provide these to the LLM during the `AgentResolver` graph compilation step.
3. **Agent Logic/Hooks**: To inject additional system-level behavior, add a new static method to `AgentHooks` in `agent_hooks.py` and invoke it within the `pre_agent_hook` or `post_agent_hook` sequence.
