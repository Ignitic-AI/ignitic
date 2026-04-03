from fastmcp import FastMCP

from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware

# Shopify Analytics tools
from servers.tools.analytics.shopify.tools import (
    shopify_get_orders_summary,
    shopify_get_customer_metrics,
    shopify_get_products_by_revenue,
    shopify_get_sales_by_day,
    shopify_get_inventory_health,
)

# Google Analytics 4 tools
from servers.tools.analytics.google_analytics.tools import (
    google_analytics_get_traffic,
    google_analytics_get_conversions,
    google_analytics_get_traffic_by_source,
    google_analytics_get_top_pages,
    google_analytics_get_traffic_by_device,
)

app = FastMCP("Analytics MCP", streamable_http_path="/")

_meta = "ignitic_identifier"

# ---------------------------------------------------------------------------
# Shopify Analytics tools
# ---------------------------------------------------------------------------
app.tool(shopify_get_orders_summary, meta={_meta: "tools.analytics_agent.shopify_get_orders_summary"})
app.tool(shopify_get_customer_metrics, meta={_meta: "tools.analytics_agent.shopify_get_customer_metrics"})
app.tool(shopify_get_products_by_revenue, meta={_meta: "tools.analytics_agent.shopify_get_products_by_revenue"})
app.tool(shopify_get_sales_by_day, meta={_meta: "tools.analytics_agent.shopify_get_sales_by_day"})
app.tool(shopify_get_inventory_health, meta={_meta: "tools.analytics_agent.shopify_get_inventory_health"})

# ---------------------------------------------------------------------------
# Google Analytics 4 tools
# ---------------------------------------------------------------------------
app.tool(google_analytics_get_traffic, meta={_meta: "tools.analytics_agent.google_analytics_get_traffic"})
app.tool(google_analytics_get_conversions, meta={_meta: "tools.analytics_agent.google_analytics_get_conversions"})
app.tool(google_analytics_get_traffic_by_source, meta={_meta: "tools.analytics_agent.google_analytics_get_traffic_by_source"})
app.tool(google_analytics_get_top_pages, meta={_meta: "tools.analytics_agent.google_analytics_get_top_pages"})
app.tool(google_analytics_get_traffic_by_device, meta={_meta: "tools.analytics_agent.google_analytics_get_traffic_by_device"})

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())
