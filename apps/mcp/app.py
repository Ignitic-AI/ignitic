import contextlib
from starlette.applications import Starlette
from starlette.routing import Mount

from servers.product_researcher_mcp import app as product_researcher_mcp

@contextlib.asynccontextmanager
async def lifespan(app: Starlette):
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(product_researcher_mcp.session_manager.run())
        # await stack.enter_async_context(math_mcp.session_manager.run())
        yield

app = Starlette(
    routes=[
        Mount("/product_researcher", app=product_researcher_mcp.streamable_http_app()),
    ],
    lifespan=lifespan
)

