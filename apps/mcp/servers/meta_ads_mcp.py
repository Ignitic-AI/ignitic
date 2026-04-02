"""
Meta Ads MCP Server.

Focused toolset for end-to-end ads manager orchestration:
- discovery (accounts, campaigns, ad sets, ads)
- creation (campaign, ad set, creative, ad)
- modification (campaign, ad set, creative, ad)
- monitoring (insights)
"""

from fastmcp import FastMCP

from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware
from servers.tools.advertising.meta_ads import (
    get_ad_accounts,
    get_campaigns,
    get_adsets,
    get_ads,
    create_campaign,
    update_campaign,
    create_adset,
    update_adset,
    create_ad_creative,
    update_ad_creative,
    create_ad,
    update_ad,
    get_insights,
)

app = FastMCP("Meta Ads MCP", streamable_http_path="/")

app.tool(
    get_ad_accounts,
    meta={"ignitic_identifier": "tools.meta_ads_agent.get_ad_accounts"},
)
app.tool(
    get_campaigns,
    meta={"ignitic_identifier": "tools.meta_ads_agent.get_campaigns"},
)
app.tool(
    get_adsets,
    meta={"ignitic_identifier": "tools.meta_ads_agent.get_adsets"},
)
app.tool(
    get_ads,
    meta={"ignitic_identifier": "tools.meta_ads_agent.get_ads"},
)
app.tool(
    create_campaign,
    meta={"ignitic_identifier": "tools.meta_ads_agent.create_campaign"},
)
app.tool(
    update_campaign,
    meta={"ignitic_identifier": "tools.meta_ads_agent.update_campaign"},
)
app.tool(
    create_adset,
    meta={"ignitic_identifier": "tools.meta_ads_agent.create_adset"},
)
app.tool(
    update_adset,
    meta={"ignitic_identifier": "tools.meta_ads_agent.update_adset"},
)
app.tool(
    create_ad_creative,
    meta={"ignitic_identifier": "tools.meta_ads_agent.create_ad_creative"},
)
app.tool(
    update_ad_creative,
    meta={"ignitic_identifier": "tools.meta_ads_agent.update_ad_creative"},
)
app.tool(
    create_ad,
    meta={"ignitic_identifier": "tools.meta_ads_agent.create_ad"},
)
app.tool(
    update_ad,
    meta={"ignitic_identifier": "tools.meta_ads_agent.update_ad"},
)
app.tool(
    get_insights,
    meta={"ignitic_identifier": "tools.meta_ads_agent.get_insights"},
)

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())
