import sys
import argparse
import asyncio
import json
from pathlib import Path
from langchain_core.messages import AIMessage

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.db import init_db
from models.chat import Chat
from services.agents.checkpointers import init_mongo_checkpointer


async def main():
    parser = argparse.ArgumentParser(
        description="Explore LangGraph checkpointer for a specific Chat ID"
    )
    parser.add_argument("chat_id", help="The ID of the Chat to explore")
    args = parser.parse_args()

    # Initialize database
    await init_db()

    # Find Chat and get thread_id
    try:
        chat = await Chat.get(args.chat_id)
    except Exception as e:
        print(f"Error fetching chat: {e}")
        return

    if not chat:
        print(f"Error: Chat with ID {args.chat_id} not found.")
        return

    thread_id = chat.thread_id
    print(f"\nFound thread_id: {thread_id} for Chat ID: {args.chat_id}")

    mongo_checkpointer = await init_mongo_checkpointer()

    checkpoint = await mongo_checkpointer.aget(
        config={"configurable": {"thread_id": thread_id}}
    )

    if checkpoint is not None:
        messages = checkpoint.get("channel_values", {}).get("messages", [])
        print(f"Found {len(messages)} messages in checkpoint.\n")

        for message in messages:
            print("Type:", type(message))
            if isinstance(message, AIMessage):
                print("Name:", getattr(message, "name", "N/A"))

            try:
                msg_dict = message.to_json()
                print(json.dumps(msg_dict, indent=2))
            except Exception:
                print(message)

            print("-----" * 16)
    else:
        print(f"No checkpoint found for thread_id: {thread_id}")


if __name__ == "__main__":
    asyncio.run(main())
