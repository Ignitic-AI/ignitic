from fastmcp import FastMCP

from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware

# Zendesk tools
from servers.tools.customer_support.zendesk.tools import (
    zendesk_list_tickets,
    zendesk_get_ticket,
    zendesk_create_ticket,
    zendesk_update_ticket,
    zendesk_close_ticket,
    zendesk_reopen_ticket,
    zendesk_get_ticket_comments,
    zendesk_add_comment,
    zendesk_get_user,
    zendesk_get_user_by_email,
    zendesk_get_user_tickets,
    zendesk_search_tickets,
    zendesk_list_views,
    zendesk_get_view_tickets,
    zendesk_get_ticket_metrics,
)

app = FastMCP("Customer Support MCP", streamable_http_path="/")

_meta = "ignitic_identifier"

# ---------------------------------------------------------------------------
# Zendesk tools
# ---------------------------------------------------------------------------
app.tool(zendesk_list_tickets, meta={_meta: "tools.customer_support_agent.zendesk_list_tickets"})
app.tool(zendesk_get_ticket, meta={_meta: "tools.customer_support_agent.zendesk_get_ticket"})
app.tool(zendesk_create_ticket, meta={_meta: "tools.customer_support_agent.zendesk_create_ticket"})
app.tool(zendesk_update_ticket, meta={_meta: "tools.customer_support_agent.zendesk_update_ticket"})
app.tool(zendesk_close_ticket, meta={_meta: "tools.customer_support_agent.zendesk_close_ticket"})
app.tool(zendesk_reopen_ticket, meta={_meta: "tools.customer_support_agent.zendesk_reopen_ticket"})
app.tool(zendesk_get_ticket_comments, meta={_meta: "tools.customer_support_agent.zendesk_get_ticket_comments"})
app.tool(zendesk_add_comment, meta={_meta: "tools.customer_support_agent.zendesk_add_comment"})
app.tool(zendesk_get_user, meta={_meta: "tools.customer_support_agent.zendesk_get_user"})
app.tool(zendesk_get_user_by_email, meta={_meta: "tools.customer_support_agent.zendesk_get_user_by_email"})
app.tool(zendesk_get_user_tickets, meta={_meta: "tools.customer_support_agent.zendesk_get_user_tickets"})
app.tool(zendesk_search_tickets, meta={_meta: "tools.customer_support_agent.zendesk_search_tickets"})
app.tool(zendesk_list_views, meta={_meta: "tools.customer_support_agent.zendesk_list_views"})
app.tool(zendesk_get_view_tickets, meta={_meta: "tools.customer_support_agent.zendesk_get_view_tickets"})
app.tool(zendesk_get_ticket_metrics, meta={_meta: "tools.customer_support_agent.zendesk_get_ticket_metrics"})

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())
