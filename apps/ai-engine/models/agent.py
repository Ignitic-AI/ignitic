from enum import Enum
from typing import Optional
from pydantic import Field
from beanie import Document
from services.agents.prompts import product_researcher_prompt, marketer_prompt


class PrebuiltAgents(str, Enum):
    PRODUCT_RESEARCHER = "product_researcher"
    MARKETER = "marketer"


class AgentType(str, Enum):
    ORCHESTRATOR = "orchestrator"
    WORKER = "worker"


class Agent(Document):
    identifier: str = Field(
        ...,
        description="the unique identifier for the agent",
    )
    u_id: Optional[str] = Field(default=None, description="Unique user identifier")
    org_id: Optional[str] = Field(
        default=None, description="Unique organization identifier"
    )
    name: str = Field(..., description="the name of the agent")
    description: str = Field(
        ..., description="a brief description of the agent's purpose and functionality"
    )
    type: AgentType = Field(
        ..., description="the type of agent, either 'orchestrator' or 'worker'"
    )
    system_prompt: str = Field(
        ...,
        description="the system prompt that guides the agent's behavior and responses",
    )
    tags: list[str] = Field(
        default_factory=list,
        description="a list of tag ids associated with the agent for categorization and searchability",
    )

    class Settings:
        name = "agents"

    @classmethod
    def prebuilt(cls, prebuilt_type: PrebuiltAgents) -> "Agent":
        """Create a prebuilt agent with predefined configuration."""
        name = PREBUILT_AGENT_NAMES[prebuilt_type]
        description = PREBUILT_AGENT_DESCRIPTIONS[prebuilt_type]
        system_prompt = PREBUILT_AGENT_PROMPTS[prebuilt_type]
        type = PREBUILT_AGENT_TYPES[prebuilt_type]

        return cls(
            name=name,
            description=description,
            type=type,
            identifier=prebuilt_type,
            system_prompt=system_prompt,
        )

    def reset_system_prompt(self):
        if self.is_prebuilt():
            if (
                self.identifier is not None
                and self.identifier in [e.value for e in PrebuiltAgents]
            ):
                self.system_prompt = PREBUILT_AGENT_PROMPTS[PrebuiltAgents(self.identifier)]
        else:
            self.system_prompt = ""

    def set_agent_name(self, name: str):
        if not self.is_prebuilt():
            self.name = name

    def set_agent_description(self, description: str):
        if not self.is_prebuilt():
            self.description = description

    def is_prebuilt(self) -> bool:
        return self.identifier in [e.value for e in PrebuiltAgents]

    def set_system_prompt(self, prompt: str):
        self.system_prompt = prompt

    def add_tag(self, tag_id: str):
        if tag_id not in self.tags:
            self.tags.append(tag_id)

    def remove_tag(self, tag_id: str):
        if tag_id in self.tags:
            self.tags.remove(tag_id)


PREBUILT_AGENT_TYPES = {
    PrebuiltAgents.PRODUCT_RESEARCHER: AgentType.WORKER,
    PrebuiltAgents.MARKETER: AgentType.WORKER,
}

PREBUILT_AGENT_NAMES = {
    PrebuiltAgents.PRODUCT_RESEARCHER: "Product Researcher Agent",
    PrebuiltAgents.MARKETER: "Marketer Agent",
}

PREBUILT_AGENT_DESCRIPTIONS = {
    PrebuiltAgents.PRODUCT_RESEARCHER: (
        "An agent specialized in conducting product research, market analysis, "
        "competitor research, pricing strategies, and web searches to gather relevant data."
    ),
    PrebuiltAgents.MARKETER: (
        "An agent focused on marketing strategies, campaign management, email marketing, "
        "social media engagement, and promotional activities to enhance brand visibility and sales."
    ),
}

PREBUILT_AGENT_PROMPTS = {
    PrebuiltAgents.PRODUCT_RESEARCHER: product_researcher_prompt,
    PrebuiltAgents.MARKETER: marketer_prompt,
}
