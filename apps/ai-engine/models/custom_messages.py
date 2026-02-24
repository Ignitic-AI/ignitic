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
