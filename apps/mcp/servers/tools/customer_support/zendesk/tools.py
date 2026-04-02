"""Zendesk customer support tools.

All tools load credentials per-request via the user's JWT (same pattern as Email Marketing).
User must save their Zendesk API credentials in Secrets → zendeskApi.
"""

from typing import Any, Dict, List, Optional
import httpx

from fastmcp.server.dependencies import get_http_headers

from .client import ZendeskClient


def _auth() -> str:
    headers = get_http_headers()
    token = headers.get("Authorization") or headers.get("authorization") or ""
    if not token:
        raise ValueError("Authorization header missing")
    return token


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

async def _request(
    client: ZendeskClient,
    method: str,
    path: str,
    json_body: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None,
) -> Any:
    url = f"{client.base_url}/{path.lstrip('/')}"
    async with httpx.AsyncClient(timeout=60.0) as http:
        resp = await http.request(
            method.upper(),
            url,
            headers=client.headers,
            json=json_body,
            params={k: v for k, v in (params or {}).items() if v is not None},
        )
    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}
    if resp.is_success:
        return data
    raise RuntimeError({"status_code": resp.status_code, "error": data})


# ---------------------------------------------------------------------------
# 1. List Tickets
# ---------------------------------------------------------------------------

async def zendesk_list_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """List support tickets with optional filtering.

    Args:
        status: Filter by status (new, open, pending, hold, solved, closed).
        priority: Filter by priority (urgent, high, normal, low).
        assignee_id: Filter by assigned agent ID.
        limit: Number of tickets to return (max 100).
        offset: Pagination offset.
    """
    client = await ZendeskClient.initialize(_auth())
    
    # Build query string
    query_parts = []
    if status:
        query_parts.append(f'status:{status}')
    if priority:
        query_parts.append(f'priority:{priority}')
    if assignee_id:
        query_parts.append(f'assignee_id:{assignee_id}')
    
    if query_parts:
        query = " ".join(query_parts)
        return await _request(client, "GET", "search.json", params={"query": query, "limit": limit, "offset": offset})
    else:
        return await _request(client, "GET", "tickets.json", params={"limit": limit, "offset": offset})


# ---------------------------------------------------------------------------
# 2. Get Single Ticket
# ---------------------------------------------------------------------------

async def zendesk_get_ticket(ticket_id: int) -> Dict[str, Any]:
    """Get detailed information about a specific ticket.

    Args:
        ticket_id: The Zendesk ticket ID.
    """
    client = await ZendeskClient.initialize(_auth())
    return await _request(client, "GET", f"tickets/{ticket_id}.json")


# ---------------------------------------------------------------------------
# 3. Create Ticket
# ---------------------------------------------------------------------------

async def zendesk_create_ticket(
    subject: str,
    description: str,
    requester_email: Optional[str] = None,
    priority: str = "normal",
    status: str = "new",
    tags: Optional[List[str]] = None,
    custom_fields: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a new support ticket.

    Args:
        subject: Ticket subject line.
        description: Detailed ticket description.
        requester_email: Customer email address.
        priority: Ticket priority (urgent, high, normal, low).
        status: Initial status (new, open, pending, hold, solved, closed).
        tags: List of tags to apply (e.g. ["billing", "urgent"]).
        custom_fields: Custom field values (e.g. {"product": "plan_a"}).
    """
    client = await ZendeskClient.initialize(_auth())
    
    body: Dict[str, Any] = {
        "ticket": {
            "subject": subject,
            "description": description,
            "priority": priority,
            "status": status,
        }
    }
    
    if requester_email:
        body["ticket"]["requester"] = {"email": requester_email}
    if tags:
        body["ticket"]["tags"] = tags
    if custom_fields:
        body["ticket"]["custom_fields"] = [
            {"id": k, "value": v} for k, v in custom_fields.items()
        ]
    
    return await _request(client, "POST", "tickets.json", json_body=body)


# ---------------------------------------------------------------------------
# 4. Update Ticket
# ---------------------------------------------------------------------------

async def zendesk_update_ticket(
    ticket_id: int,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee_id: Optional[int] = None,
    tags: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Update ticket status, priority, assignee, or tags.

    Args:
        ticket_id: The ticket ID to update.
        status: New status (new, open, pending, hold, solved, closed).
        priority: New priority (urgent, high, normal, low).
        assignee_id: Assign to an agent (user ID).
        tags: Replace tags with these values.
    """
    client = await ZendeskClient.initialize(_auth())
    
    body: Dict[str, Any] = {"ticket": {}}
    if status:
        body["ticket"]["status"] = status
    if priority:
        body["ticket"]["priority"] = priority
    if assignee_id:
        body["ticket"]["assignee_id"] = assignee_id
    if tags is not None:
        body["ticket"]["tags"] = tags
    
    return await _request(client, "PUT", f"tickets/{ticket_id}.json", json_body=body)


# ---------------------------------------------------------------------------
# 5. Close Ticket
# ---------------------------------------------------------------------------

async def zendesk_close_ticket(ticket_id: int) -> Dict[str, Any]:
    """Mark a ticket as solved/closed.

    Args:
        ticket_id: The ticket ID to close.
    """
    client = await ZendeskClient.initialize(_auth())
    return await _request(client, "PUT", f"tickets/{ticket_id}.json",
                         json_body={"ticket": {"status": "solved"}})


# ---------------------------------------------------------------------------
# 6. Reopen Ticket
# ---------------------------------------------------------------------------

async def zendesk_reopen_ticket(ticket_id: int) -> Dict[str, Any]:
    """Reopen a closed or solved ticket.

    Args:
        ticket_id: The ticket ID to reopen.
    """
    client = await ZendeskClient.initialize(_auth())
    return await _request(client, "PUT", f"tickets/{ticket_id}.json",
                         json_body={"ticket": {"status": "open"}})


# ---------------------------------------------------------------------------
# 7. Get Ticket Comments
# ---------------------------------------------------------------------------

async def zendesk_get_ticket_comments(ticket_id: int) -> Dict[str, Any]:
    """Get all comments/conversation history for a ticket.

    Args:
        ticket_id: The ticket ID.
    """
    client = await ZendeskClient.initialize(_auth())
    return await _request(client, "GET", f"tickets/{ticket_id}/comments.json")


# ---------------------------------------------------------------------------
# 8. Add Comment to Ticket
# ---------------------------------------------------------------------------

async def zendesk_add_comment(
    ticket_id: int,
    body: str,
    public: bool = True,
    attachment_ids: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """Add a comment/reply to a ticket (public or private note).

    Args:
        ticket_id: The ticket ID.
        body: Comment text.
        public: True = visible to customer, False = internal note.
        attachment_ids: List of uploaded attachment IDs to attach.
    """
    client = await ZendeskClient.initialize(_auth())
    
    comment_body: Dict[str, Any] = {"body": body, "public": public}
    if attachment_ids:
        comment_body["uploads"] = attachment_ids
    
    return await _request(client, "POST", f"tickets/{ticket_id}/comments.json",
                         json_body={"comment": comment_body})


# ---------------------------------------------------------------------------
# 9. Get User (Customer)
# ---------------------------------------------------------------------------

async def zendesk_get_user(user_id: int) -> Dict[str, Any]:
    """Get customer/user details by ID.

    Args:
        user_id: The Zendesk user ID.
    """
    client = await ZendeskClient.initialize(_auth())
    return await _request(client, "GET", f"users/{user_id}.json")


# ---------------------------------------------------------------------------
# 10. Get User by Email
# ---------------------------------------------------------------------------

async def zendesk_get_user_by_email(email: str) -> Dict[str, Any]:
    """Look up a customer by email address.

    Args:
        email: Customer email address.
    """
    client = await ZendeskClient.initialize(_auth())
    return await _request(client, "GET", f"users/search.json", params={"query": email})


# ---------------------------------------------------------------------------
# 11. Get User Tickets
# ---------------------------------------------------------------------------

async def zendesk_get_user_tickets(user_id: int) -> Dict[str, Any]:
    """Get all tickets for a specific customer.

    Args:
        user_id: The Zendesk user ID.
    """
    client = await ZendeskClient.initialize(_auth())
    return await _request(client, "GET", f"users/{user_id}/tickets.json")


# ---------------------------------------------------------------------------
# 12. Search Tickets
# ---------------------------------------------------------------------------

async def zendesk_search_tickets(query: str, limit: int = 50) -> Dict[str, Any]:
    """Search tickets by keyword (subject, description, comments).

    Args:
        query: Search query (e.g. "payment failed", "shipping delay").
        limit: Max results.
    """
    client = await ZendeskClient.initialize(_auth())
    return await _request(client, "GET", "search.json", params={"query": query, "limit": limit})


# ---------------------------------------------------------------------------
# 13. List Views (Saved Searches)
# ---------------------------------------------------------------------------

async def zendesk_list_views() -> Dict[str, Any]:
    """List all saved ticket views (My Unsolved, Open, etc.)."""
    client = await ZendeskClient.initialize(_auth())
    return await _request(client, "GET", "views.json")


# ---------------------------------------------------------------------------
# 14. Get View Tickets
# ---------------------------------------------------------------------------

async def zendesk_get_view_tickets(view_id: int) -> Dict[str, Any]:
    """Get all tickets matching a saved view.

    Args:
        view_id: The view ID (from zendesk_list_views).
    """
    client = await ZendeskClient.initialize(_auth())
    return await _request(client, "GET", f"views/{view_id}/tickets.json")


# ---------------------------------------------------------------------------
# 15. Get Ticket Metrics
# ---------------------------------------------------------------------------

async def zendesk_get_ticket_metrics(
    ticket_id: int,
) -> Dict[str, Any]:
    """Get performance metrics for a ticket (resolution time, SLA, satisfaction).

    Args:
        ticket_id: The ticket ID.
    """
    client = await ZendeskClient.initialize(_auth())
    return await _request(client, "GET", f"tickets/{ticket_id}/metrics.json")
