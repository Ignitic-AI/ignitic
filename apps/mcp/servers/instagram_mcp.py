"""
Instagram MCP Server.

Exposes Instagram business account operations as MCP tools via the
Instagram Graph API (served through ``graph.facebook.com``).

Tools
-----
Profile
  • get_profile_info   – retrieve Instagram business profile details

Media
  • get_media_posts    – fetch recent posts from an Instagram account
  • get_media_insights – retrieve engagement metrics for specific posts
  • publish_media      – upload and publish images/videos to Instagram
"""

from fastmcp import FastMCP

from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware
from servers.tools.social_media_marketing.instagram import (
    get_profile_info,
    get_media_posts,
    get_media_insights,
    publish_media,
)

# --------------------------------------------------------------------- #
# Server                                                                  #
# --------------------------------------------------------------------- #

app = FastMCP("Instagram MCP", streamable_http_path="/")

# --------------------------------------------------------------------- #
# Tools – Profile                                                        #
# --------------------------------------------------------------------- #

app.tool(
    get_profile_info,
    meta={"ignitic_identifier": "tools.instagram_agent.get_profile_info"},
)

# --------------------------------------------------------------------- #
# Tools – Media                                                           #
# --------------------------------------------------------------------- #

app.tool(
    get_media_posts,
    meta={"ignitic_identifier": "tools.instagram_agent.get_media_posts"},
)

app.tool(
    get_media_insights,
    meta={"ignitic_identifier": "tools.instagram_agent.get_media_insights"},
)

app.tool(
    publish_media,
    meta={"ignitic_identifier": "tools.instagram_agent.publish_media"},
)

# --------------------------------------------------------------------- #
# Middleware                                                               #
# --------------------------------------------------------------------- #

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())
