from fastmcp import FastMCP
from servers.tools.social_media_marketing.twitter_trends import twitter_trends
from servers.tools.social_media_marketing.tiktok_trends import tiktok_trends
from servers.tools.advertising.facebook_ads_scraper import facebook_ads_scraper
from servers.tools.Seo.site_domain_authority_seo import site_domain_authority_seo
from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware

app = FastMCP("Marketer MCP", streamable_http_path="/")

app.tool(twitter_trends, meta={"ignitic_identifier": "tools.marketer.twitter_trends"})
app.tool(tiktok_trends, meta={"ignitic_identifier": "tools.marketer.tiktok_trends"})
app.tool(
    facebook_ads_scraper,
    meta={"ignitic_identifier": "tools.marketer.facebook_ads_scraper"},
)
app.tool(
    site_domain_authority_seo,
    meta={"ignitic_identifier": "tools.marketer.site_domain_authority_seo"},
)

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())
