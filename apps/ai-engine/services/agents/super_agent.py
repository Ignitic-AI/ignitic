from langgraph_supervisor import create_supervisor
from services.agents.marketer_agent import marketer_agent
from services.agents.product_researcher_agent import product_researcher_agent
from services.agents.llms import llm
from services.agents.prompts import super_agent_prompt
from services.agents.checkpointers import mongo_checkpointer


super_agent = create_supervisor(
    supervisor_name="SuperAgent",
    model=llm,
    agents=[product_researcher_agent, marketer_agent],
    prompt=super_agent_prompt,
    add_handoff_back_messages=True,
    output_mode="full_history",
).compile(checkpointer=mongo_checkpointer)
