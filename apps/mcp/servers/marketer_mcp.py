from mcp.server.fastmcp import FastMCP
from servers.tools.social_media_marketing.twitter_trends import twitter_trends
from servers.tools.social_media_marketing.tiktok_trends import tiktok_trends

app = FastMCP("Marketer MCP", streamable_http_path="/")

app.add_tool(twitter_trends)
app.add_tool(tiktok_trends)

