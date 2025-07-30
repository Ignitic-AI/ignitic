from services.agents.super_agent import super_agent

# Invoke the super agent and get the final result
result = super_agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "What are the latest trends in e-commerce marketing? and what are some best product categories to sell?",
            }
        ]
    }
)

# Pretty print the final result
print("=== Super Agent Result ===")
for message in result["messages"]:
    message.pretty_print()
    print()  # Add blank line between messages
