from fastmcp import FastMCP
from servers.tools.Seo.site_domain_authority_seo import site_domain_authority_seo
from servers.tools.Seo.meta_tags_scraper_seo import meta_tags_scraper_seo
from servers.tools.product_researcher.shopify_product_scraper import (
    shopify_product_scraper,
)
from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware

app = FastMCP("SEO MCP", streamable_http_path="/")

app.tool(
    site_domain_authority_seo,
    meta={"ignitic_identifier": "tools.seo_agent.site_domain_authority_seo"},
)
app.tool(
    meta_tags_scraper_seo,
    meta={"ignitic_identifier": "tools.seo_agent.meta_tags_scraper_seo"},
)
app.tool(
    shopify_product_scraper,
    meta={"ignitic_identifier": "tools.seo_agent.shopify_product_scraper"},
)

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())
