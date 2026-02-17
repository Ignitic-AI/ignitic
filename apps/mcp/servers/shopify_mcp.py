from fastmcp import FastMCP
from servers.tools.crm.shopify.products import (
    create_product,
    delete_product,
    get_product_by_id,
    get_products,
    publish_product,
    unpublish_product,
)
from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware

app = FastMCP("Shopify MCP", streamable_http_path="/")

app.tool(create_product, meta={"ignitic_identifier": "tools.shopify_agent.create_product"})
app.tool(get_product_by_id, meta={"ignitic_identifier": "tools.shopify_agent.get_product_by_id"})
app.tool(get_products, meta={"ignitic_identifier": "tools.shopify_agent.get_products"})
app.tool(delete_product, meta={"ignitic_identifier": "tools.shopify_agent.delete_product"})
app.tool(publish_product, meta={"ignitic_identifier": "tools.shopify_agent.publish_product"})
app.tool(unpublish_product, meta={"ignitic_identifier": "tools.shopify_agent.unpublish_product"})

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())