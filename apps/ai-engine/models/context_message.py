"""
ContextMessage — a HumanMessage subclass used to inject per-turn context
(user info, org info, RAG chunks) into the agent message history without
modifying the original user message.

Design:
  - type = "context"  →  serialised state has a distinct type so the frontend
                          can identify and suppress these messages in the UI.
  - subclasses HumanMessage  →  LangChain's API adapters use isinstance checks
                                 (not the type field) to assign role="user",
                                 so all OpenAI-compatible providers accept it
                                 transparently without any extra conversion.
"""

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
    
