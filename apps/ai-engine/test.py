from services.agents.super_agent import super_agent

# Invoke the super agent and get the final result
result = super_agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "what is my name?",
            }
        ]
    },
    config={
        "configurable": {
            "thread_id": "2"
        }
    }
)

# Pretty print the final result
print("=== Super Agent Result ===")
for message in result["messages"]:
    message.pretty_print()
    print()  # Add blank line between messages
