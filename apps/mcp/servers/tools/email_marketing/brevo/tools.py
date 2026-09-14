"""Brevo (SendInBlue) email marketing tools.

All tools load credentials per-request via the user's JWT (same pattern as Shopify/HubSpot).
User must save their Brevo API key in Secrets → sendInBlueApi → apiKey.
"""

from typing import Any, Dict, List, Optional

import httpx

from fastmcp.server.dependencies import get_http_headers

from .client import BrevoClient


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

async def _request(
    client: BrevoClient,
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


def _auth() -> str:
    headers = get_http_headers()
    token = headers.get("Authorization") or headers.get("authorization") or ""
    if not token:
        raise ValueError("Authorization header missing")
    return token


# ---------------------------------------------------------------------------
# Contact tools
# ---------------------------------------------------------------------------

async def brevo_get_contacts(
    limit: int = 50,
    offset: int = 0,
    email: Optional[str] = None,
) -> Dict[str, Any]:
    """List contacts from Brevo. Optionally filter by email.

    Args:
        limit: Number of contacts to return (max 1000).
        offset: Pagination offset.
        email: Filter to a specific contact email.
    """
    client = await BrevoClient.initialize(_auth())
    if email:
        return await _request(client, "GET", f"contacts/{email}")
    return await _request(client, "GET", "contacts", params={"limit": limit, "offset": offset})


async def brevo_create_contact(
    email: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    list_ids: Optional[List[int]] = None,
    attributes: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a new contact in Brevo.

    Args:
        email: Contact email address (required).
        first_name: Contact first name.
        last_name: Contact last name.
        list_ids: List of Brevo list IDs to add the contact to.
        attributes: Additional contact attributes e.g. {"COMPANY": "Acme"}.
    """
    client = await BrevoClient.initialize(_auth())
    attrs = attributes or {}
    if first_name:
        attrs["FIRSTNAME"] = first_name
    if last_name:
        attrs["LASTNAME"] = last_name
    body: Dict[str, Any] = {"email": email, "attributes": attrs}
    if list_ids:
        body["listIds"] = list_ids
    return await _request(client, "POST", "contacts", json_body=body)


async def brevo_update_contact(
    email: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    list_ids: Optional[List[int]] = None,
    attributes: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Update an existing Brevo contact by email.

    Args:
        email: Contact email address (required).
        first_name: New first name.
        last_name: New last name.
        list_ids: Replace list memberships with these list IDs.
        attributes: Attributes to update e.g. {"COMPANY": "New Co"}.
    """
    client = await BrevoClient.initialize(_auth())
    attrs = attributes or {}
    if first_name:
        attrs["FIRSTNAME"] = first_name
    if last_name:
        attrs["LASTNAME"] = last_name
    body: Dict[str, Any] = {}
    if attrs:
        body["attributes"] = attrs
    if list_ids is not None:
        body["listIds"] = list_ids
    await _request(client, "PUT", f"contacts/{email}", json_body=body)
    return {"message": f"Contact {email} updated successfully"}


async def brevo_delete_contact(email: str) -> Dict[str, Any]:
    """Delete a Brevo contact by email.

    Args:
        email: Contact email address to delete.
    """
    client = await BrevoClient.initialize(_auth())
    await _request(client, "DELETE", f"contacts/{email}")
    return {"message": f"Contact {email} deleted successfully"}


# ---------------------------------------------------------------------------
# List / Segment tools
# ---------------------------------------------------------------------------

async def brevo_list_contact_lists(
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """List all contact lists/segments in Brevo.

    Args:
        limit: Number of lists to return.
        offset: Pagination offset.
    """
    client = await BrevoClient.initialize(_auth())
    return await _request(client, "GET", "contacts/lists", params={"limit": limit, "offset": offset})


async def brevo_create_contact_list(
    name: str,
    folder_id: int = 1,
) -> Dict[str, Any]:
    """Create a new contact list in Brevo.

    Args:
        name: Name for the new list.
        folder_id: Brevo folder ID to place the list in (default 1 = root).
    """
    client = await BrevoClient.initialize(_auth())
    return await _request(client, "POST", "contacts/lists", json_body={"name": name, "folderId": folder_id})


async def brevo_add_contacts_to_list(
    list_id: int,
    emails: List[str],
) -> Dict[str, Any]:
    """Add one or more contacts to a Brevo list.

    Args:
        list_id: The Brevo list ID.
        emails: List of email addresses to add.
    """
    client = await BrevoClient.initialize(_auth())
    return await _request(
        client, "POST", f"contacts/lists/{list_id}/contacts/add",
        json_body={"emails": emails}
    )


async def brevo_remove_contacts_from_list(
    list_id: int,
    emails: List[str],
) -> Dict[str, Any]:
    """Remove contacts from a Brevo list.

    Args:
        list_id: The Brevo list ID.
        emails: List of email addresses to remove.
    """
    client = await BrevoClient.initialize(_auth())
    return await _request(
        client, "POST", f"contacts/lists/{list_id}/contacts/remove",
        json_body={"emails": emails}
    )


# ---------------------------------------------------------------------------
# Email Campaign tools
# ---------------------------------------------------------------------------

async def brevo_list_campaigns(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """List email campaigns in Brevo.

    Args:
        status: Filter by status: draft, sent, archive, queued, suspended, inProcess.
        limit: Number of campaigns to return.
        offset: Pagination offset.
    """
    client = await BrevoClient.initialize(_auth())
    params: Dict[str, Any] = {"limit": limit, "offset": offset}
    if status:
        params["status"] = status
    return await _request(client, "GET", "emailCampaigns", params=params)


async def brevo_get_campaign(campaign_id: int) -> Dict[str, Any]:
    """Get details of a specific Brevo email campaign.

    Args:
        campaign_id: The Brevo campaign ID.
    """
    client = await BrevoClient.initialize(_auth())
    return await _request(client, "GET", f"emailCampaigns/{campaign_id}")


async def brevo_create_campaign(
    name: str,
    subject: str,
    sender_name: str,
    sender_email: str,
    html_content: Optional[str] = None,
    html_url: Optional[str] = None,
    reply_to: Optional[str] = None,
    list_ids: Optional[List[int]] = None,
    template_id: Optional[int] = None,
    scheduled_at: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new email campaign in Brevo.

    Args:
        name: Internal campaign name.
        subject: Email subject line.
        sender_name: Sender display name.
        sender_email: Sender email address (must be verified in Brevo).
        html_content: HTML body of the email.
        html_url: URL to fetch HTML content from (alternative to html_content).
        reply_to: Reply-to email address.
        list_ids: List IDs to send the campaign to.
        template_id: Brevo template ID to use instead of html_content.
        scheduled_at: ISO 8601 datetime to schedule the send e.g. "2025-06-01T10:00:00Z".
    """
    client = await BrevoClient.initialize(_auth())
    body: Dict[str, Any] = {
        "name": name,
        "subject": subject,
        "sender": {"name": sender_name, "email": sender_email},
    }
    if html_content:
        body["htmlContent"] = html_content
    if html_url:
        body["htmlUrl"] = html_url
    if template_id:
        body["templateId"] = template_id
    if reply_to:
        body["replyTo"] = reply_to
    if list_ids:
        body["recipients"] = {"listIds": list_ids}
    if scheduled_at:
        body["scheduledAt"] = scheduled_at
    return await _request(client, "POST", "emailCampaigns", json_body=body)


async def brevo_send_campaign_now(campaign_id: int) -> Dict[str, Any]:
    """Send an existing Brevo email campaign immediately.

    Args:
        campaign_id: The Brevo campaign ID to send.
    """
    client = await BrevoClient.initialize(_auth())
    await _request(client, "POST", f"emailCampaigns/{campaign_id}/sendNow")
    return {"message": f"Campaign {campaign_id} sent successfully"}


async def brevo_schedule_campaign(campaign_id: int, scheduled_at: str) -> Dict[str, Any]:
    """Schedule a Brevo campaign for a future date/time.

    Args:
        campaign_id: The Brevo campaign ID.
        scheduled_at: ISO 8601 datetime string e.g. "2025-06-01T10:00:00Z".
    """
    client = await BrevoClient.initialize(_auth())
    await _request(client, "POST", f"emailCampaigns/{campaign_id}/sendAt",
                   json_body={"scheduledAt": scheduled_at})
    return {"message": f"Campaign {campaign_id} scheduled for {scheduled_at}"}


async def brevo_get_campaign_stats(campaign_id: int) -> Dict[str, Any]:
    """Get statistics for a sent Brevo campaign (opens, clicks, bounces, unsubscribes).

    Args:
        campaign_id: The Brevo campaign ID.
    """
    client = await BrevoClient.initialize(_auth())
    return await _request(client, "GET", f"emailCampaigns/{campaign_id}/aggregatedCsvReport")


async def brevo_delete_campaign(campaign_id: int) -> Dict[str, Any]:
    """Delete a Brevo email campaign.

    Args:
        campaign_id: The Brevo campaign ID to delete.
    """
    client = await BrevoClient.initialize(_auth())
    await _request(client, "DELETE", f"emailCampaigns/{campaign_id}")
    return {"message": f"Campaign {campaign_id} deleted successfully"}


# ---------------------------------------------------------------------------
# Transactional email
# ---------------------------------------------------------------------------

async def brevo_send_transactional_email(
    to_email: str,
    to_name: Optional[str] = None,
    subject: Optional[str] = None,
    html_content: Optional[str] = None,
    text_content: Optional[str] = None,
    template_id: Optional[int] = None,
    template_params: Optional[Dict[str, Any]] = None,
    sender_name: str = "IgniticAI",
    sender_email: Optional[str] = None,
    reply_to_email: Optional[str] = None,
) -> Dict[str, Any]:
    """Send a single transactional email via Brevo.
    Use this for order confirmations, cart abandonment, password resets, etc.

    Args:
        to_email: Recipient email address.
        to_name: Recipient display name.
        subject: Email subject (required if not using a template).
        html_content: HTML body of the email.
        text_content: Plain-text body of the email.
        template_id: Brevo template ID (overrides html_content/subject if set).
        template_params: Variables to pass to a Brevo template e.g. {"FIRSTNAME": "John"}.
        sender_name: Sender display name.
        sender_email: Sender email (must be verified in Brevo; uses account default if None).
        reply_to_email: Reply-to email address.
    """
    client = await BrevoClient.initialize(_auth())
    recipient: Dict[str, Any] = {"email": to_email}
    if to_name:
        recipient["name"] = to_name

    body: Dict[str, Any] = {
        "to": [recipient],
        "sender": {"name": sender_name, "email": sender_email or "noreply@igniticai.com"},
    }
    if template_id:
        body["templateId"] = template_id
        if template_params:
            body["params"] = template_params
    else:
        if subject:
            body["subject"] = subject
        if html_content:
            body["htmlContent"] = html_content
        if text_content:
            body["textContent"] = text_content
    if reply_to_email:
        body["replyTo"] = {"email": reply_to_email}

    return await _request(client, "POST", "smtp/email", json_body=body)


# ---------------------------------------------------------------------------
# Email Templates
# ---------------------------------------------------------------------------

async def brevo_list_templates(
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """List saved email templates in Brevo.

    Args:
        limit: Number of templates to return.
        offset: Pagination offset.
    """
    client = await BrevoClient.initialize(_auth())
    return await _request(client, "GET", "smtp/templates", params={"limit": limit, "offset": offset})


async def brevo_get_template(template_id: int) -> Dict[str, Any]:
    """Get a specific Brevo email template by ID.

    Args:
        template_id: The Brevo template ID.
    """
    client = await BrevoClient.initialize(_auth())
    return await _request(client, "GET", f"smtp/templates/{template_id}")


# ---------------------------------------------------------------------------
# SMTP / Delivery activity
# ---------------------------------------------------------------------------

async def brevo_get_smtp_events(
    email: Optional[str] = None,
    event: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """Get SMTP transactional email event logs (delivered, opened, clicked, bounced, etc.).

    Args:
        email: Filter by recipient email.
        event: Filter by event type: delivered, hardBounce, softBounce, blocked, spam,
               invalid, deferred, opened, clicked, unsubscribed.
        limit: Number of events to return.
        offset: Pagination offset.
    """
    client = await BrevoClient.initialize(_auth())
    params: Dict[str, Any] = {"limit": limit, "offset": offset}
    if email:
        params["email"] = email
    if event:
        params["event"] = event
    return await _request(client, "GET", "smtp/statistics/events", params=params)


# ---------------------------------------------------------------------------
# Account info
# ---------------------------------------------------------------------------

async def brevo_get_account_info() -> Dict[str, Any]:
    """Get Brevo account information (plan, credits, sender email, etc.)."""
    client = await BrevoClient.initialize(_auth())
    return await _request(client, "GET", "account")
