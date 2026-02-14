from mcp.server.fastmcp import FastMCP
from servers.tools.Seo.site_domain_authority_seo import site_domain_authority_seo
from servers.tools.Seo.meta_tags_scraper_seo import meta_tags_scraper_seo
from servers.tools.product_researcher.shopify_product_scraper import shopify_product_scraper

app = FastMCP("SEO MCP", streamable_http_path="/")

app.add_tool(site_domain_authority_seo)
app.add_tool(meta_tags_scraper_seo)
app.add_tool(shopify_product_scraper)
