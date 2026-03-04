from typing import Annotated, List
from models.agent import Agent, AgentState
from models.custom_messages import TaskMessage
from langgraph.prebuilt import InjectedState
from langgraph.types import Command
from langchain_core.tools import tool
from langchain_core.messages import AIMessage, BaseMessage
from loguru import logger





# ---------------------------------------------------------------------------
# Cycle detection (unchanged)
# ---------------------------------------------------------------------------


def detect_hierarchy_cycles(agents: List[Agent]) -> None:
    """Detect cycles in the agent hierarchy.

    Each agent has a ``parent`` field pointing to another agent's identifier
    or ``"super_agent"`` (the implicit root).  A cycle exists when following
    parent pointers from any agent eventually leads back to itself.

    Uses iterative DFS with a *recursion-stack* marker so that shared
    ancestry (diamond shapes) is handled correctly.

    Raises:
        ValueError: If a cycle is detected, listing the involved agents.
    """
    parent_map: dict[str, str] = {
        agent.identifier: (agent.parent or "super_agent") for agent in agents
    }
    identifier_set = set(parent_map.keys())

    VISITED = "visited"
    IN_STACK = "in_stack"
    state: dict[str, str] = {}

    def _dfs(node: str) -> None:
        # Nodes outside the current agent set (e.g. "super_agent") are safe.
        if node not in identifier_set:
            return
        if state.get(node) == VISITED:
            return
        if state.get(node) == IN_STACK:
            # Walk back through the parent chain to build a readable cycle.
            cycle = [node]
            cur = parent_map[node]
            while cur != node:
                cycle.append(cur)
                cur = parent_map[cur]
            cycle.append(node)
            raise ValueError(
                "Cycle detected in agent hierarchy: " + " -> ".join(reversed(cycle))
            )

        state[node] = IN_STACK
        _dfs(parent_map.get(node, "super_agent"))
        state[node] = VISITED

    for identifier in identifier_set:
        _dfs(identifier)

    logger.debug("✅ Agent hierarchy cycle check passed")


# ---------------------------------------------------------------------------
# Handoff tool helpers
# ---------------------------------------------------------------------------


def _safe_tool_name(identifier: str) -> str:
    """Convert an agent identifier to a valid Python/tool name."""
    return identifier.replace("-", "_").replace(" ", "_")


def create_transfer_to_child_tool(
    child_identifier: str,
    child_name: str,
    child_description: str,
):
    """Factory that returns a LangChain tool for handing off to a child agent.

    The tool updates graph state via ``Command(graph=Command.PARENT)`` so the
    parent ``StateGraph`` immediately routes to the child node without waiting
    for the calling react-agent subgraph to finish its normal tool loop.

    State mutations:
      • ``active_agent``  → set to *child_identifier*
      • ``agent_stack``   → current active_agent pushed onto the stack
    """
    fn_name = f"transfer_to_{_safe_tool_name(child_identifier)}"

    def _transfer_fn(
        instruction: Annotated[
            str,
            "Clear task instruction or context to pass to the child agent.",
        ],
        state: Annotated[AgentState, InjectedState],
    ) -> Command:
        current_stack: list[str] = list(state.get("agent_stack") or [])
        current_agent: str = state.get("active_agent") or "super_agent"
        new_stack = current_stack + [current_agent]

        logger.info(
            f"🔀 Transfer: {current_agent} → {child_identifier} | stack: {new_stack}"
        )

        # When Command(graph=Command.PARENT) fires, the react-agent subgraph
        # exits immediately and its accumulated internal messages are never
        # flushed to the parent StateGraph's messages channel.  We recover
        # them here by reading the subgraph's own state["messages"].
        #
        # The last message in the subgraph at this point is the AIMessage
        # that contains tool_calls=[transfer_to_<child>].  We intentionally
        # drop it because:
        #   1. It has no matching ToolMessage (the subgraph exited before one
        #      could be written), so including it would leave an open tool-call
        #      in the message history that confuses subsequent LLM calls.
        #   2. We replace it with a cleaner handoff_msg that reads naturally
        #      in the conversation and carries the instruction text.
        #
        # All earlier messages (intermediate reasoning AIMessages, ToolMessages
        # from prior tool calls within this turn) are included verbatim.
        # The parent's add_messages reducer deduplicates by message ID, so
        # any messages already present in the parent state are not doubled.
        subgraph_messages: list[BaseMessage] = list(state.get("messages") or [])

        # Drop the trailing AIMessage with the transfer tool_call (if present)
        flushed_messages: list[BaseMessage] = []
        if subgraph_messages:
            last = subgraph_messages[-1]
            has_transfer_call = (
                isinstance(last, AIMessage)
                and bool(getattr(last, "tool_calls", None))
                and any(
                    tc.get("name", "").startswith("transfer_to_")
                    for tc in (last.tool_calls or [])
                )
            )
            flushed_messages = (
                subgraph_messages[:-1] if has_transfer_call else subgraph_messages
            )

        # Synthetic handoff record that replaces the dropped AIMessage.
        handoff_msg = AIMessage(
            content=f"[Transferring to {child_identifier}]\n{instruction}",
            name=current_agent,
        )

        act_command_msg = TaskMessage(
            content="Act",
            name=current_agent,
        )

        return Command(
            graph=Command.PARENT,
            update={
                "active_agent": child_identifier,
                "agent_stack": new_stack,
                # Flush all intermediate subgraph messages to the parent, then
                # append the clean handoff record.
                "messages": flushed_messages + [handoff_msg, act_command_msg],
            },
            goto=child_identifier,
        )

    # Build the @tool with the correct name and docstring
    _transfer_fn.__name__ = fn_name
    _transfer_fn.__qualname__ = fn_name
    _transfer_fn.__doc__ = (
        f"Transfer control to the {child_name}.\n\n"
        f"{child_description}\n\n"
        "Provide a clear instruction or task context so the child agent "
        "knows exactly what is expected."
    )
    return tool(_transfer_fn)


def create_transfer_back_to_parent_tool(
    current_identifier: str,
    fallback_parent_identifier: str,
):
    """Factory that returns a LangChain tool for returning control to the parent.

    The tool:
      1. Pops the top of ``agent_stack`` to determine the correct parent.
      2. Appends a concise ``AIMessage`` summary so the parent sees only the
         key result (not every intermediate tool call the child made).
      3. Routes back to the parent node via ``Command(graph=Command.PARENT)``.

    State mutations:
      • ``active_agent``  → set to the popped parent identifier
      • ``agent_stack``   → top entry removed
      • ``messages``      → summary AIMessage appended
    """

    def _transfer_back_fn(
        final_summary: Annotated[
            str,
            (
                "Concise summary of what was accomplished, decisions made, "
                "or the result to hand back to the parent agent."
            ),
        ],
        state: Annotated[AgentState, InjectedState],
    ) -> Command:
        stack: list[str] = list(state.get("agent_stack") or [])

        if stack:
            parent = stack[-1]
            new_stack = stack[:-1]
        else:
            parent = fallback_parent_identifier or "super_agent"
            new_stack = []

        logger.info(
            f"🔙 Transfer back: {current_identifier} → {parent} | remaining stack: {new_stack}"
        )

        # Mirror the same message-flushing logic used in create_transfer_to_child_tool:
        # read the subgraph's full accumulated messages and write them into the parent
        # StateGraph's messages channel via Command.update so nothing is lost when the
        # subgraph exits via Command(graph=Command.PARENT).
        #
        # The last message at this point is the AIMessage whose tool_calls contains
        # transfer_back_to_parent.  Drop it for the same reason as in the forward
        # transfer: it has no matching ToolMessage and would leave an open tool-call
        # in the history that confuses future LLM calls.  The summary_msg below
        # replaces it with a clean, readable result record.
        subgraph_messages: list[BaseMessage] = list(state.get("messages") or [])

        flushed_messages: list[BaseMessage] = []
        if subgraph_messages:
            last = subgraph_messages[-1]
            has_return_call = (
                isinstance(last, AIMessage)
                and bool(getattr(last, "tool_calls", None))
                and any(
                    tc.get("name", "") == "transfer_back_to_parent"
                    for tc in (last.tool_calls or [])
                )
            )
            flushed_messages = (
                subgraph_messages[:-1] if has_return_call else subgraph_messages
            )

        # Terse summary that replaces the dropped AIMessage.  The parent LLM
        # receives this as the final word from the child; the full intermediate
        # dialogue is preserved in the checkpointer for audit purposes.
        summary_msg = AIMessage(
            content=(f"[Sub-task completed by {current_identifier}]\n{final_summary}"),
            name=current_identifier,
        )

        return Command(
            graph=Command.PARENT,
            update={
                "active_agent": parent,
                "agent_stack": new_stack,
                # Flush all intermediate subgraph messages, then append the
                # clean summary record.  add_messages deduplicates by ID so
                # messages already in the parent state are not doubled.
                "messages": flushed_messages + [summary_msg],
            },
            goto=parent,
        )

    _transfer_back_fn.__name__ = "transfer_back_to_parent"
    _transfer_back_fn.__qualname__ = "transfer_back_to_parent"
    _transfer_back_fn.__doc__ = (
        f"Return control to the parent agent (currently: {fallback_parent_identifier}) "
        "once your sub-task is fully complete.\n\n"
        "Provide a concise final_summary that describes what was accomplished "
        "or any important result the parent should act on.\n\n"
        "⚠️  Only call this when your portion of the task is truly finished. "
        "If you still need user input or have more steps, continue working instead."
    )
    return tool(_transfer_back_fn)