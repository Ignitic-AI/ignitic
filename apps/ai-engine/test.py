# from services.agents.checkpointers import mongo_checkpointer
# from services.agents.utils import pretty_print_messages
# from services.agents.agents import ainvoke_agents, AgentResolver

# # Invoke the super agent and get the final result
# result = AgentResolver().resolve([]).invoke(
#     {
#         "messages": [
#             {
#                 "role": "user",
#                 "content": "How to improve my marketing?",
#             }
#         ]
#     },
#     config={
#         "configurable": {
#             "thread_id": "3"
#         }
#     }
# )

# # Pretty print the final result
# print("=== Super Agent Result ===")
# for message in result["messages"]:
#     message.pretty_print()
#     print()  # Add blank line between messages
# # checkpoint = mongo_checkpointer.get(config={"configurable": {"thread_id": "3"}})
# # if checkpoint is not None:
# # 	for message in checkpoint['channel_values']['messages']:
# # 		message.pretty_print()
# # else:
# # 	print("No checkpoint found for thread_id: 3")

# from services.agents.llms import llm

# print(llm.invoke([{"role": "user", "content": "Hello, world!"}]))

import asyncio
from fastmcp import Client

client = Client("http://localhost:8080/product_researcher")

async def main():
    async with client:
        print(await client.list_tools())

asyncio.run(main())


