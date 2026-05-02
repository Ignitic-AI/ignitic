# Agents Service Architecture & Documentation

The `agents/` service directory is the core of the Ignitic AI Engine's conversational, autonomous, and multi-agent behavior. It heavily leverages **LangChain** and **LangGraph** to build highly capable, stateful, and context-aware agent networks. 

This README provides an in-depth breakdown of how the agent network is constructed, how it executes, how memory and context are handled, and how Model Context Protocol (MCP) tools are integrated.

---

## 1. Multi-Agent Architecture & Network Topology

The system uses `LangGraph` to orchestrate either single-agent workflows or complex hierarchical multi-agent networks. This logic resides primarily in `agent_resolver.py`.

### Hierarchical StateGraph Construction
If multiple agents are active in a conversation, the engine dynamically builds a hierarchical `StateGraph`.
- **Super Agent Root**: A root `super_agent` node is created. It doesn't perform tasks directly but acts as a router, delegating tasks to child agents.
- **Cycle Detection**: The graph strictly enforces a Directed Acyclic Graph (DAG) for the hierarchy. `detect_hierarchy_cycles` runs a DFS to ensure no recursive loops (e.g., A -> B -> A) exist before compilation.
- **Handoff / Transfer Tools**: Agents move control between each other using dynamic LangChain `@tool` instances that return `Command(graph=Command.PARENT)`.
  - `transfer_to_child`: Pushes the current agent onto an `agent_stack` in the state and routes to a specific child agent, dropping the intermediate tool-call message and replacing it with a clean handoff record (`[Transferring to ...]`).
  - `transfer_back_to_parent`: Called by a sub-agent when it finishes its task. It pops the `agent_stack`, returns control to the parent, and appends a concise summary of the result.

### The Agent Graph Nodes
The compiled graph consists of:
1. **`summarize`**: A LangMem `SummarizationNode` that runs *first* on every turn.
2. **`router_node`**: Responsible for determining which agent holds control based on the `active_agent` state, and for correctly injecting the summary into the message timeline.
3. **Agent Nodes**: A distinct node (created via `create_react_agent`) for the `super_agent` and each requested child agent.

---

## 2. Execution and Streaming Workflow

The primary entry point for agent inference is the `AgentService` (`agent_service.py`), which manages resilient execution and chunked streaming to the frontend.

1. **Context Initialization**: 
   When `astream_agents` is called, the system processes uploaded file URLs and images. For documents, it attempts to parse them (using `MarkItDown`) and formats them into a `FileMessage`.
2. **Graph Resolution**:
   `AgentResolver` builds or retrieves the compiled LangGraph based on the requested agents and binds the resolved LLM provider (`get_llm`).
3. **Execution & Retries**:
   The `astream_events` method of LangGraph is called. The `AgentService` manages an exponential backoff retry loop (up to 3 retries) for resilient execution against transient API failures.
4. **Token Interception & Streaming**:
   The execution stream intercepts `astream_events` (version="v2") and classifies chunks before yielding them to the client:
   - `on_chat_model_stream`: Emits actual LLM text tokens. It intelligently ignores tokens generated internally by the `summarize` node.
   - `on_tool_start` / `on_tool_end`: Intercepts tool executions, serializing the arguments and results safely, and notifies the client of tool usage in real-time.
   - `summarize_start` / `summarize_end`: Signals when the system is updating its internal memory so the frontend can show a specific loading state.

---

## 3. Context Management, Memory, and Summarization

The agent system is designed to handle very long contexts gracefully without crashing the LLM context window.

### Graphiti & Long-Term Memory
- Global long-term semantic memory is managed through Graphiti. Tools like `save_memory` and `search_memory` (in `tools/graphiti_memory_tools.py`) are injected into the agent's context, allowing the agent to remember facts across completely different chat sessions.

### Short-Term Memory & Summarization
- Inside `agent_resolver.py`, a `SummarizationNode` monitors the token count of the current conversation. 
- When the history exceeds `MAX_TOKENS_BEFORE_SUMMARY` (e.g., 6000 tokens), it invokes a summarization LLM to compress the oldest messages into a system summary.
- The `router_node` cleanly handles injecting this summary into the LangGraph state. It generates fresh UUIDs for the summarized messages so LangGraph's `add_messages` reducer accurately clears out the old context and prepends the new `SystemMessage` summary, preserving chronological order.

### Chat Persistence (`ChatService`)
- While LangGraph maintains the compressed state via its checkpointer (MongoDB), the `ChatService` manually saves the *raw* message history to a `ChatMessage` MongoDB collection.
- This dual-layer approach ensures that while the LLM receives a compressed context, the frontend user interface can always retrieve the exact, uncompressed dialogue history.

### Hook Injections (`agent_hooks.py`)
`AgentHooks` intercepts the graph at the `pre_model_hook` and `post_model_hook` stages:
- **System Context Injection**: `_inject_system_context_hook` injects a `<injected_context>` block right before the user's message containing details about the current User and Organization (Industry, Size, Role).
- **RAG Hook**: `_memory_retreiver_hook` intercepts the user's query, fetches relevant vector database chunks, and injects them as a `ContextMessage`.
- **Vision Model Support**: `_convert_image_tool_messages` detects images returned by MCP tools (as base64). Since ToolMessages cannot contain raw image objects, it replaces the tool message with text and injects a multimodal `HumanMessage` carrying the image so vision-capable LLMs (like GPT-4o) can analyze it.
- **Analytics Logging**: `_agent_run_log_hook` logs token usage, latency, and costs to the `AgentRun` table for dashboard analytics.

---

## 4. MCP Tools Connection

The engine natively speaks the Model Context Protocol (MCP) to interact with external microservices and tools via `mcp_client.py`.

### MultiServerMCPClient
- The `MCPClientService` initializes a `MultiServerMCPClient`.
- It creates individual server connections over HTTP streaming (`streamable_http`) for each prebuilt agent and a general `custom` server.
- The connection attaches vital context headers: `Authorization`, `X-Chat-ID`, and `X-Image-URLs` so the external MCP server knows who is making the request and within what context.

### Tool Caching and Filtering
- **Caching**: Fetching tool definitions across HTTP introduces latency. The MCP Client implements a 10-minute in-memory TTL cache (`_TOOLS_CACHE`) for tool definitions.
- **Agent Allowlisting**: After fetching tools, `_filter_tools_for_agent` ensures that a custom agent only receives the specific tools it was explicitly authorized to use (via its `tool_names` property).

---

## 5. Adding and Extending Features

To expand the capabilities of this network:
1. **Local Tools**: Create a new file in `services/agents/tools/`, use the LangChain `@tool` decorator, and ensure strict type-hinting and docstrings. Import and append the tool inside `agent_resolver.py`.
2. **MCP Tools**: Add new capabilities to the external MCP server. The `MCPClientService` will dynamically fetch and provide these to the LLM during the `AgentResolver` graph compilation step.
3. **Agent Logic/Hooks**: To inject additional system-level behavior (like moderations or external API checks before the LLM runs), add a new static method to `AgentHooks` in `agent_hooks.py` and invoke it within the `pre_agent_hook` sequence.
