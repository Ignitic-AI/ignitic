from langgraph.prebuilt import create_react_agent
from services.agents.llms import llm


# Marketing tools (you'll need to define these)
marketing_tools = [
    # Add your marketing-specific tools here
    # Example: social_media_analyzer, campaign_optimizer, etc.
]

# Create the marketing agent with system prompt
marketer_agent = create_react_agent(
    name="MarketerAgent",
    model=llm,
    tools=marketing_tools,
    prompt=(
        "You are a professional marketing agent specializing in e-commerce. "
        "Your role is to analyze market trends, create marketing strategies, "
        "optimize campaigns, and provide actionable marketing insights. "
        "Always provide data-driven recommendations and creative solutions."
    ),
)
