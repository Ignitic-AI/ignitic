from typing import Literal
from langchain_core.messages import HumanMessage


class ContextMessage(HumanMessage):
    """
    A specialised HumanMessage carrying injected context (user/org info,
    RAG chunks). Inserted immediately before the user's HumanMessage each
    turn so the model receives fresh context and the original message is
    never mutated.

    type="context" makes these messages easily filterable by the frontend
    while remaining role="user" from the LLM's perspective.
    """

    type: Literal["context"] = "context"  # type: ignore[assignment]


class ImageMessage(HumanMessage):
    """
    A specialised HumanMessage carrying image content extracted from a
    ToolMessage response (e.g. MCP image results).

    The OpenAI/OpenRouter API only accepts multimodal content in user-role
    messages, so tool-returned images must be forwarded as HumanMessages.
    Using a dedicated subclass keeps these synthetic messages distinguishable
    from real user messages at the frontend.

    type="image" makes these messages easily filterable by the frontend
    while remaining role="user" from the LLM's perspective.
    """

    type: Literal["image"] = "image"  # type: ignore[assignment]


class FileMessage(HumanMessage):
    """
    A specialised HumanMessage carrying a file URL (PDF, DOCX, etc.) provided
    by the user as input context. One FileMessage is emitted per file URL,
    inserted before the user's HumanMessage each turn.

    type="file" makes these messages easily filterable by the frontend
    while remaining role="user" from the LLM's perspective.
    """

    type: Literal["file"] = "file"  # type: ignore[assignment]


class TaskMessage(HumanMessage):
    """
    A specialised HumanMessage injected by the parent agent's transfer tool
    when handing a task off to a child (or returning a result back to a
    parent).  Placing it last in state ensures the receiving react-agent's
    LLM sees a pending 'user' turn and executes, rather than producing a
    blank response.

    type="task" keeps it distinguishable from real user messages so that
    pre_model_hook skips RAG / context-injection for these synthetic turns,
    while remaining role="user" from the LLM's perspective.
    """

    type: Literal["task"] = "task"  # type: ignore[assignment]
