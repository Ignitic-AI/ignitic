from fastmcp import FastMCP
from servers.tools.product_researcher.product_google_dork import google_dork_search
from servers.tools.product_researcher.apify_amazon_search import apify_amazon_search
from servers.tools.product_researcher.apify_ebay_scraper import apify_ebay_search
from servers.tools.product_researcher.google_trends import google_trends
from servers.tools.product_researcher.shopify_product_scraper import shopify_product_scraper
from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware

app = FastMCP("Product Researcher MCP", streamable_http_path="/")


app.tool(google_dork_search, meta={"ignitic_identifier": "tools.product_researcher.google_dork_search"})
app.tool(apify_amazon_search, meta={"ignitic_identifier": "tools.product_researcher.apify_amazon_search"})
app.tool(apify_ebay_search, meta={"ignitic_identifier": "tools.product_researcher.apify_ebay_search"})
app.tool(google_trends, meta={"ignitic_identifier": "tools.product_researcher.google_trends"})
app.tool(shopify_product_scraper, meta={"ignitic_identifier": "tools.product_researcher.shopify_product_scraper"})

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())