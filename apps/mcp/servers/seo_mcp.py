from mcp.server.fastmcp import FastMCP
from servers.tools.Seo.site_domain_authority_seo import site_domain_authority_seo

app = FastMCP("SEO MCP", streamable_http_path="/")

app.add_tool(site_domain_authority_seo)
