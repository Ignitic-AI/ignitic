from mcp.server.fastmcp import FastMCP
from servers.tools.product_researcher.product_google_dork import google_dork_search
from servers.tools.product_researcher.apify_amazon_search import apify_amazon_search
from servers.tools.product_researcher.apify_ebay_scraper import apify_ebay_search
from servers.tools.product_researcher.google_trends import google_trends
from servers.tools.product_researcher.shopify_product_scraper import shopify_product_scraper

app = FastMCP("Product Researcher MCP", streamable_http_path="/")

app.add_tool(google_dork_search)
app.add_tool(apify_amazon_search)
app.add_tool(apify_ebay_search)
app.add_tool(google_trends)
app.add_tool(shopify_product_scraper)