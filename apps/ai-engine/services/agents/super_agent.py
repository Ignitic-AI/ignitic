from langgraph_supervisor import create_supervisor
from langchain.chat_models import init_chat_model
from services.agents.marketer_agent import marketer_agent
from services.agents.product_researcher_agent import product_researcher_agent
from services.agents.llms import llm

super_agent = create_supervisor(
    model=llm,
    agents=[product_researcher_agent, marketer_agent],
    prompt=(
        "You are a supervisor managing two agents:\n"
        "1. Product Researcher Agent: Specializes in analyzing market trends and product strategies.\n"
        "2. Marketer Agent: Focuses on creating marketing strategies and optimizing campaigns.\n"
        "If a query is simple enough, you can answer it directly. "
    ),
    add_handoff_back_messages=True,
    output_mode="full_history",
).compile()
