"""Google Ads MCP Server."""

from fastmcp import FastMCP

from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware
from servers.tools.advertising.google_ads import (
    list_accessible_customers,
    get_campaigns,
    get_ad_groups,
    get_ads,
    get_creatives,
    create_campaign,
    update_campaign,
    create_ad_group,
    update_ad_group,
    create_creative_asset,
    update_creative_asset,
    create_ad,
    update_ad,
    get_performance_metrics,
)

app = FastMCP("Google Ads MCP", streamable_http_path="/")

app.tool(
    list_accessible_customers,
    meta={"ignitic_identifier": "tools.google_ads_agent.list_accessible_customers"},
)
app.tool(
    get_campaigns,
    meta={"ignitic_identifier": "tools.google_ads_agent.get_campaigns"},
)
app.tool(
    get_ad_groups,
    meta={"ignitic_identifier": "tools.google_ads_agent.get_ad_groups"},
)
app.tool(
    get_ads,
    meta={"ignitic_identifier": "tools.google_ads_agent.get_ads"},
)
app.tool(
    get_creatives,
    meta={"ignitic_identifier": "tools.google_ads_agent.get_creatives"},
)
app.tool(
    create_campaign,
    meta={"ignitic_identifier": "tools.google_ads_agent.create_campaign"},
)
app.tool(
    update_campaign,
    meta={"ignitic_identifier": "tools.google_ads_agent.update_campaign"},
)
app.tool(
    create_ad_group,
    meta={"ignitic_identifier": "tools.google_ads_agent.create_ad_group"},
)
app.tool(
    update_ad_group,
    meta={"ignitic_identifier": "tools.google_ads_agent.update_ad_group"},
)
app.tool(
    create_creative_asset,
    meta={"ignitic_identifier": "tools.google_ads_agent.create_creative_asset"},
)
app.tool(
    update_creative_asset,
    meta={"ignitic_identifier": "tools.google_ads_agent.update_creative_asset"},
)
app.tool(
    create_ad,
    meta={"ignitic_identifier": "tools.google_ads_agent.create_ad"},
)
app.tool(
    update_ad,
    meta={"ignitic_identifier": "tools.google_ads_agent.update_ad"},
)
app.tool(
    get_performance_metrics,
    meta={"ignitic_identifier": "tools.google_ads_agent.get_performance_metrics"},
)

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())
