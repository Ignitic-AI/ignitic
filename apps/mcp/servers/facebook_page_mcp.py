"""
Facebook Page MCP Server.

Exposes Facebook Page management operations as MCP tools via the
Facebook Graph API.

Tools
-----
Posts
  • create_post          – publish a text post on the Page
  • get_page_posts       – list recent posts on the Page
  • delete_post          – permanently delete a post
  • post_image           – publish an image post with a caption

Comments
  • get_post_comments       – list comments on a post
  • get_number_of_comments  – count comments on a post
  • reply_to_comment        – reply to an existing comment

Engagement
  • get_number_of_likes  – count likes / reactions on a post
"""

from fastmcp import FastMCP

from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware
from servers.tools.social_media_marketing.facebook_pages import (
    create_post,
    get_page_posts,
    delete_post,
    post_image,
    get_post_comments,
    get_number_of_comments,
    reply_to_comment,
    get_number_of_likes,
)

# --------------------------------------------------------------------- #
# Server                                                                  #
# --------------------------------------------------------------------- #

app = FastMCP("Facebook Page MCP", streamable_http_path="/")

# --------------------------------------------------------------------- #
# Tools – Posts                                                           #
# --------------------------------------------------------------------- #

app.tool(
    create_post,
    meta={"ignitic_identifier": "tools.facebook_page_agent.create_post"},
)

app.tool(
    get_page_posts,
    meta={"ignitic_identifier": "tools.facebook_page_agent.get_page_posts"},
)

app.tool(
    delete_post,
    meta={"ignitic_identifier": "tools.facebook_page_agent.delete_post"},
)

app.tool(
    post_image,
    meta={"ignitic_identifier": "tools.facebook_page_agent.post_image"},
)

# --------------------------------------------------------------------- #
# Tools – Comments                                                        #
# --------------------------------------------------------------------- #

app.tool(
    get_post_comments,
    meta={"ignitic_identifier": "tools.facebook_page_agent.get_post_comments"},
)

app.tool(
    get_number_of_comments,
    meta={"ignitic_identifier": "tools.facebook_page_agent.get_number_of_comments"},
)

app.tool(
    reply_to_comment,
    meta={"ignitic_identifier": "tools.facebook_page_agent.reply_to_comment"},
)

# --------------------------------------------------------------------- #
# Tools – Engagement                                                      #
# --------------------------------------------------------------------- #

app.tool(
    get_number_of_likes,
    meta={"ignitic_identifier": "tools.facebook_page_agent.get_number_of_likes"},
)

# --------------------------------------------------------------------- #
# Middleware                                                               #
# --------------------------------------------------------------------- #

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())
