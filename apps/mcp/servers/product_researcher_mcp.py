from mcp.server.fastmcp import FastMCP
from servers.tools.product_google_dork import google_dork_search
from servers.tools.apify_amazon_search import apify_amazon_search
from servers.tools.apify_ebay_scraper import apify_ebay_search
from servers.tools.google_trends import google_trends

app = FastMCP("Product Researcher MCP", streamable_http_path="/")

app.add_tool(google_dork_search)
app.add_tool(apify_amazon_search)
app.add_tool(apify_ebay_search)
app.add_tool(google_trends)