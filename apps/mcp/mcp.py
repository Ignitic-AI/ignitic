from starlette.applications import Starlette
from starlette.routing import Mount

from servers.product_researcher_mcp import app as product_researcher_mcp

app = Starlette(
    routes=[
        Mount("/product_researcher", app=product_researcher_mcp.streamable_http_app()),
    ]
)

