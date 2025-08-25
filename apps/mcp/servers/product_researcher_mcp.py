from mcp.server.fastmcp import FastMCP
from servers.tools.product_google_dork import google_dork_search

app = FastMCP("Product Researcher MCP", streamable_http_path="/")

app.add_tool(google_dork_search)