from mcp.server.fastmcp import FastMCP
from servers.tools.social_media_marketing.twitter_trends import twitter_trends
from servers.tools.social_media_marketing.tiktok_trends import tiktok_trends
from servers.tools.advertising.facebook_ads_scraper import facebook_ads_scraper
from servers.tools.Seo.site_domain_authority_seo import site_domain_authority_seo

app = FastMCP("Marketer MCP", streamable_http_path="/")

app.add_tool(twitter_trends)
app.add_tool(tiktok_trends)
app.add_tool(facebook_ads_scraper)
app.add_tool(site_domain_authority_seo)

