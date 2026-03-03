from datetime import datetime
from typing import List, Optional
from beanie import Document
from pydantic import Field
from pymongo import IndexModel, ASCENDING


class Chat(Document):
    """
    Represents a chat session in the system.

    Attributes:

    """

    u_id: str = Field(..., description="Unique user identifier")
    org_id: Optional[str] = Field(None, description="Unique organization identifier")
    thread_id: str = Field(..., description="Unique thread identifier")
    agents: List[str] = Field(default=[], description="The agent handling the chat")
    name: Optional[str] = Field(None, description="Human-readable name for the chat")
    created_at: datetime = Field(
        default_factory=datetime.now, description="Creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.now, description="Last update timestamp"
    )

    class Settings:
        name = "chats"


class ChatMessage(Document):
    """Stores one LangChain message belonging to a chat.

    Each agent invocation appends only *new* messages (identified by their
    LangChain ``message_id``) so the collection acts as an append-only log
    that is entirely unaffected by the LangGraph ``SummarizationNode``
    compressing the in-memory / checkpointer state.

    Advantages over a single history document:
    - No MongoDB 16 MB document-size ceiling.
    - Efficient recent-message pagination via a sorted range scan on the
      ``(chat_id, created_at)`` compound index.
    - Idempotent saves: the unique ``(chat_id, message_id)`` index prevents
      duplicates even if the same message list is flushed more than once.

    Attributes:
        chat_id:    String id of the parent ``Chat`` document.
        message_id: LangChain ``BaseMessage.id`` — used for deduplication.
        data:       The message serialised as a single dict produced by
                    ``langchain_core.messages.messages_to_dict``.
        created_at: Insertion timestamp, used for ordering.
    """

    chat_id: str = Field(..., description="Parent Chat document id")
    message_id: str = Field(..., description="LangChain message id — unique per chat")
    data: dict = Field(
        ..., description="Single message serialised with messages_to_dict"
    )
    created_at: datetime = Field(
        default_factory=datetime.now, description="Insertion timestamp for ordering"
    )

    class Settings:
        name = "chat_messages"
        indexes = [
            # Primary read pattern: all messages for a chat in insertion order.
            IndexModel(
                [("chat_id", ASCENDING), ("created_at", ASCENDING)],
            ),
            # Deduplication guard: prevents double-inserting the same message.
            IndexModel(
                [("chat_id", ASCENDING), ("message_id", ASCENDING)],
                unique=True,
            ),
        ]
