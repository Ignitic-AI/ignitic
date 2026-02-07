from mcp.server.fastmcp import FastMCP
from servers.tools.crm.shopify.products import (
    create_product,
    delete_product,
    get_product_by_id,
    get_products,
    publish_product,
    unpublish_product,
)

app = FastMCP("Shopify MCP", streamable_http_path="/")

app.add_tool(create_product)
app.add_tool(get_product_by_id)
app.add_tool(get_products)
app.add_tool(delete_product)
app.add_tool(publish_product)
app.add_tool(unpublish_product)

