import sys
from pathlib import Path
from langchain_core.messages import AIMessage

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


async def main():
    from services.agents.checkpointers import init_mongo_checkpointer

    mongo_checkpointer = await init_mongo_checkpointer()

    thread_id = "7be8599e-9e90-4396-9081-7be520322e36"

    checkpoint = await mongo_checkpointer.aget(
        config={"configurable": {"thread_id": thread_id}}
    )
    if checkpoint is not None:
        for message in checkpoint["channel_values"]["messages"]:
            # message.pretty_print()
            print("Type:", type(message))
            if type(message) is AIMessage:
                print(message.name)
            print(message)
            print("-----" * 16)
    else:
        print("No checkpoint found for thread_id: 3")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
