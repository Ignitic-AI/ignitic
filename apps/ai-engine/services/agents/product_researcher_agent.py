from langgraph.prebuilt import create_react_agent
from services.agents.llms import llm
from services.agents.prompts import product_researcher_prompt


# Marketing tools (you'll need to define these)
researching_tools = [
    # Add your marketing-specific tools here
    # Example: social_media_analyzer, campaign_optimizer, etc.
]

# Create the marketing agent with system prompt
product_researcher_agent = create_react_agent(
    name="ProductResearcherAgent",
    model=llm,
    tools=researching_tools,
    prompt=product_researcher_prompt,
)
