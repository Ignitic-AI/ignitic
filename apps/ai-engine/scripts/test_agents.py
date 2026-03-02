import sys
from pathlib import Path
from fastapi.security import HTTPAuthorizationCredentials


# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


async def main():
    from services.agents.checkpointers import init_mongo_checkpointer
    from services.agents.memory_stores import init_mongo_memory_store
    from core.auth import AuthProvider
    from services.agents.agent_service import (
        AgentService,
    )
    from core.db import init_db

    await init_mongo_checkpointer()
    await init_mongo_memory_store()
    await init_db()

    auth = AuthProvider(
        auth=HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="REDACTED",
        )
    )

    agent_service = AgentService(auth=auth)

    thread_id = "test-30"

    async for chunk in agent_service.astream_agents(
        agents=await agent_service.get_user_agents(),
        message="What are top 5 xiaomi earbuds on amazon",
        # message="Which is good among these?",
        chat_id=f"chat-{thread_id}",
        thread_id=thread_id,
        model="google/gemini-2.5-flash-lite",
    ):
        print("Chunk:", chunk["chunk_index"])


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
