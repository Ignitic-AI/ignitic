from datetime import datetime
from enum import Enum
from typing import Annotated, List, NotRequired, Optional, Sequence, TypedDict
from langchain_core.messages import BaseMessage
from langgraph.graph import add_messages
from langmem.short_term import RunningSummary
from langgraph.managed import RemainingSteps
from pydantic import Field
from beanie import Document
from services.agents.prompts import (
    product_researcher_prompt,
    marketer_prompt,
    seo_prompt,
    gdrive_prompt,
    shopify_prompt,
    hubspot_prompt,
    facebook_page_prompt,
    instagram_prompt,
    email_marketing_prompt,
)


class PrebuiltAgents(str, Enum):
    PRODUCT_RESEARCHER = "product_researcher"
    MARKETER = "marketer"
    SEO = "seo_agent"
    GDRIVE = "gdrive_agent"
    SHOPIFY = "shopify_agent"
    HUBSPOT = "hubspot_agent"
    FACEBOOK_PAGE = "facebook_page_agent"
    INSTAGRAM = "instagram_agent"
    EMAIL_MARKETING = "email_marketing_agent"


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
    parent: str = Field(
        default="super_agent",
        description="the parent agent's identifier, default is 'super_agent'",
    )
    system_prompt: str = Field(
        ...,
        description="the system prompt that guides the agent's behavior and responses",
    )
    tags: list[str] = Field(
        default_factory=list,
        description="a list of tag ids associated with the agent for categorization and searchability",
    )
    tool_names: list[str] = Field(
        default_factory=list,
        description=(
            "Optional allowlist of MCP tool names enabled for this agent. "
            "If empty, all tools exposed by the agent's MCP server are available."
        ),
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
        parent = PREBUILT_AGENT_PARENTS[prebuilt_type]

        return cls(
            name=name,
            description=description,
            type=type,
            identifier=prebuilt_type,
            system_prompt=system_prompt,
            parent=parent,
        )

    def reset_attributes(self):
        if self.is_prebuilt():
            self.set_agent_name(PREBUILT_AGENT_NAMES[PrebuiltAgents(self.identifier)])
            self.set_agent_description(
                PREBUILT_AGENT_DESCRIPTIONS[PrebuiltAgents(self.identifier)]
            )
            self.set_system_prompt(
                PREBUILT_AGENT_PROMPTS[PrebuiltAgents(self.identifier)]
            )
        else:
            self.name = "Custom Agent"
            self.description = "A custom user-defined agent."
            self.system_prompt = ""
        self.tags = []

    def reset_system_prompt(self):
        if self.is_prebuilt():
            if self.identifier is not None and self.identifier in [
                e.value for e in PrebuiltAgents
            ]:
                self.system_prompt = PREBUILT_AGENT_PROMPTS[
                    PrebuiltAgents(self.identifier)
                ]
        else:
            self.system_prompt = ""

    def set_agent_name(self, name: str):
        self.name = name

    def set_agent_description(self, description: str):
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

    def update_tags(self, tag_ids: list[str]):
        self.tags = tag_ids


def _replace_list(old: List[str], new: List[str]) -> List[str]:
    """Reducer that always replaces the list entirely (last-write-wins)."""
    return new


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    remaining_steps: NotRequired[RemainingSteps]
    start_time: datetime
    # ------------------------------------------------------------------
    # Routing state — used by the custom hierarchical StateGraph.
    # active_agent: identifier of the agent currently holding control.
    #   None / missing → route to super_agent (default entry point).
    # agent_stack: breadcrumb trail of ancestor agent identifiers so
    #   that transfer_back_to_parent can pop reliably even across
    #   multiple levels of nesting.
    # ------------------------------------------------------------------
    active_agent: NotRequired[Optional[str]]
    agent_stack: NotRequired[Annotated[List[str], _replace_list]]
    # ------------------------------------------------------------------
    # Summarization state — managed by the SummarizationNode that runs
    # at the start of every graph turn to prevent context bloat.
    # summarized_messages: the compressed history; worker agents read
    #   from `messages` (mapped by router_node from this field).
    # context: running summary metadata produced by SummarizationNode.
    # ------------------------------------------------------------------
    summarized_messages: NotRequired[list[BaseMessage]]
    context: NotRequired[dict[str, RunningSummary]]


PREBUILT_AGENT_TYPES = {
    PrebuiltAgents.PRODUCT_RESEARCHER: AgentType.WORKER,
    PrebuiltAgents.MARKETER: AgentType.ORCHESTRATOR,
    PrebuiltAgents.SEO: AgentType.WORKER,
    PrebuiltAgents.GDRIVE: AgentType.WORKER,
    PrebuiltAgents.SHOPIFY: AgentType.WORKER,
    PrebuiltAgents.HUBSPOT: AgentType.WORKER,
    PrebuiltAgents.FACEBOOK_PAGE: AgentType.WORKER,
    PrebuiltAgents.INSTAGRAM: AgentType.WORKER,
    PrebuiltAgents.EMAIL_MARKETING: AgentType.WORKER,
}

PREBUILT_AGENT_PARENTS = {
    PrebuiltAgents.PRODUCT_RESEARCHER: "super_agent",
    PrebuiltAgents.MARKETER: "super_agent",
    PrebuiltAgents.SEO: "super_agent",
    PrebuiltAgents.GDRIVE: "super_agent",
    PrebuiltAgents.SHOPIFY: "super_agent",
    PrebuiltAgents.HUBSPOT: "super_agent",
    PrebuiltAgents.FACEBOOK_PAGE: PrebuiltAgents.MARKETER.value,
    PrebuiltAgents.INSTAGRAM: PrebuiltAgents.MARKETER.value,
    PrebuiltAgents.EMAIL_MARKETING: PrebuiltAgents.MARKETER.value,
}

PREBUILT_AGENT_NAMES = {
    PrebuiltAgents.PRODUCT_RESEARCHER: "Product Researcher Agent",
    PrebuiltAgents.MARKETER: "Marketer Agent",
    PrebuiltAgents.SEO: "SEO Agent",
    PrebuiltAgents.GDRIVE: "Google Drive Agent",
    PrebuiltAgents.SHOPIFY: "Shopify Agent",
    PrebuiltAgents.HUBSPOT: "HubSpot Agent",
    PrebuiltAgents.FACEBOOK_PAGE: "Facebook Page Agent",
    PrebuiltAgents.INSTAGRAM: "Instagram Agent",
    PrebuiltAgents.EMAIL_MARKETING: "Email Marketing Agent",
}

PREBUILT_AGENT_DESCRIPTIONS = {
    PrebuiltAgents.PRODUCT_RESEARCHER: (
        "An agent specialized in conducting product research, market analysis, "
        "competitor research, pricing strategies, and web searches to gather relevant data."
    ),
    PrebuiltAgents.MARKETER: (
        "An agent focused on social marketing strategies, Facebook Page, and Instagram "
        "management to enhance brand visibility and social engagement."
    ),
    PrebuiltAgents.SEO: (
        "An agent focused on SEO analysis, including domain authority checks and practical recommendations "
        "to improve search visibility and competitive positioning."
    ),
    PrebuiltAgents.GDRIVE: (
        "An agent with access to Google Drive that can search for files and folders, "
        "retrieve file contents, and edit files on behalf of the user."
    ),
    PrebuiltAgents.SHOPIFY: (
        "An agent with access to Shopify that can manage products, orders, and customer interactions "
        "to help run an online store effectively."
    ),
    PrebuiltAgents.HUBSPOT: (
        "An agent with access to HubSpot CRM (Developer API): contacts, companies, deals, tickets, "
        "notes, custom objects, search, batch APIs, associations, pipelines, properties, and owners."
    ),
    PrebuiltAgents.FACEBOOK_PAGE: (
        "An agent with access to Facebook Page management that can create posts, respond to comments, "
        "and analyze page insights to enhance social media presence."
    ),
    PrebuiltAgents.INSTAGRAM: (
        "An agent with access to Instagram management that can create posts, respond to comments, "
        "and analyze account insights to boost engagement and follower growth."
    ),
    PrebuiltAgents.EMAIL_MARKETING: (
        "An agent for email marketing via Brevo and Mailchimp: manage contacts and lists, "
        "create and send campaigns, track open/click stats, and send transactional emails."
    ),
}

PREBUILT_AGENT_PROMPTS = {
    PrebuiltAgents.PRODUCT_RESEARCHER: product_researcher_prompt,
    PrebuiltAgents.MARKETER: marketer_prompt,
    PrebuiltAgents.SEO: seo_prompt,
    PrebuiltAgents.GDRIVE: gdrive_prompt,
    PrebuiltAgents.SHOPIFY: shopify_prompt,
    PrebuiltAgents.HUBSPOT: hubspot_prompt,
    PrebuiltAgents.FACEBOOK_PAGE: facebook_page_prompt,
    PrebuiltAgents.INSTAGRAM: instagram_prompt,
    PrebuiltAgents.EMAIL_MARKETING: email_marketing_prompt,
}
