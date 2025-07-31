from langgraph.prebuilt import create_react_agent
from services.agents.llms import llm
from services.agents.prompts import marketer_prompt


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
    prompt=marketer_prompt,
)
