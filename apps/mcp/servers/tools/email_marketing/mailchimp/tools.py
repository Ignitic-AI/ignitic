"""Mailchimp email marketing tools.

All tools load credentials per-request via the user's JWT (same pattern as Shopify/HubSpot).
User must save their Mailchimp API key in Secrets → mailchimpApi → apiKey.
API key format must include the data center suffix e.g. abc123-us14.
"""

from typing import Any, Dict, List, Optional

import httpx

from fastmcp.server.dependencies import get_http_headers

from .client import MailchimpClient


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

async def _request(
    client: MailchimpClient,
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
            auth=client.auth,
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
# Account / Ping
# ---------------------------------------------------------------------------

async def mailchimp_ping() -> Dict[str, Any]:
    """Ping the Mailchimp API to verify the API key is valid."""
    client = await MailchimpClient.initialize(_auth())
    return await _request(client, "GET", "ping")


async def mailchimp_get_account_info() -> Dict[str, Any]:
    """Get Mailchimp account information (account name, email, plan, total contacts)."""
    client = await MailchimpClient.initialize(_auth())
    return await _request(client, "GET", "")


# ---------------------------------------------------------------------------
# Audiences (Lists)
# ---------------------------------------------------------------------------

async def mailchimp_list_audiences(
    count: int = 20,
    offset: int = 0,
) -> Dict[str, Any]:
    """List all Mailchimp audiences (mailing lists).

    Args:
        count: Number of audiences to return (max 1000).
        offset: Pagination offset.
    """
    client = await MailchimpClient.initialize(_auth())
    return await _request(client, "GET", "lists", params={"count": count, "offset": offset})


async def mailchimp_get_audience(list_id: str) -> Dict[str, Any]:
    """Get details of a specific Mailchimp audience.

    Args:
        list_id: The Mailchimp audience/list ID.
    """
    client = await MailchimpClient.initialize(_auth())
    return await _request(client, "GET", f"lists/{list_id}")


# ---------------------------------------------------------------------------
# Members (Contacts)
# ---------------------------------------------------------------------------

async def mailchimp_list_members(
    list_id: str,
    status: Optional[str] = None,
    count: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """List members of a Mailchimp audience.

    Args:
        list_id: The Mailchimp audience/list ID.
        status: Filter by subscription status: subscribed, unsubscribed, cleaned,
                pending, transactional.
        count: Number of members to return.
        offset: Pagination offset.
    """
    client = await MailchimpClient.initialize(_auth())
    params: Dict[str, Any] = {"count": count, "offset": offset}
    if status:
        params["status"] = status
    return await _request(client, "GET", f"lists/{list_id}/members", params=params)


async def mailchimp_get_member(list_id: str, email: str) -> Dict[str, Any]:
    """Get a specific member from a Mailchimp audience by email.

    Args:
        list_id: The Mailchimp audience/list ID.
        email: Member email address.
    """
    import hashlib
    subscriber_hash = hashlib.md5(email.lower().encode()).hexdigest()
    client = await MailchimpClient.initialize(_auth())
    return await _request(client, "GET", f"lists/{list_id}/members/{subscriber_hash}")


async def mailchimp_add_member(
    list_id: str,
    email: str,
    status: str = "subscribed",
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    tags: Optional[List[str]] = None,
    merge_fields: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Add a new member to a Mailchimp audience.

    Args:
        list_id: The Mailchimp audience/list ID.
        email: Member email address.
        status: Subscription status: subscribed, unsubscribed, cleaned, pending.
        first_name: Member first name.
        last_name: Member last name.
        tags: List of tags to apply to the member.
        merge_fields: Merge fields e.g. {"FNAME": "John", "LNAME": "Doe"}.
    """
    client = await MailchimpClient.initialize(_auth())
    fields = merge_fields or {}
    if first_name:
        fields["FNAME"] = first_name
    if last_name:
        fields["LNAME"] = last_name
    body: Dict[str, Any] = {
        "email_address": email,
        "status": status,
        "merge_fields": fields,
    }
    if tags:
        body["tags"] = [{"name": t, "status": "active"} for t in tags]
    return await _request(client, "POST", f"lists/{list_id}/members", json_body=body)


async def mailchimp_update_member(
    list_id: str,
    email: str,
    status: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    merge_fields: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Update an existing Mailchimp audience member.

    Args:
        list_id: The Mailchimp audience/list ID.
        email: Member email address.
        status: New status: subscribed, unsubscribed, cleaned, pending.
        first_name: Updated first name.
        last_name: Updated last name.
        merge_fields: Updated merge fields.
    """
    import hashlib
    subscriber_hash = hashlib.md5(email.lower().encode()).hexdigest()
    client = await MailchimpClient.initialize(_auth())
    fields = merge_fields or {}
    if first_name:
        fields["FNAME"] = first_name
    if last_name:
        fields["LNAME"] = last_name
    body: Dict[str, Any] = {}
    if status:
        body["status"] = status
    if fields:
        body["merge_fields"] = fields
    return await _request(client, "PATCH", f"lists/{list_id}/members/{subscriber_hash}", json_body=body)


async def mailchimp_archive_member(list_id: str, email: str) -> Dict[str, Any]:
    """Archive (unsubscribe/remove) a member from a Mailchimp audience.

    Args:
        list_id: The Mailchimp audience/list ID.
        email: Member email address to archive.
    """
    import hashlib
    subscriber_hash = hashlib.md5(email.lower().encode()).hexdigest()
    client = await MailchimpClient.initialize(_auth())
    await _request(client, "DELETE", f"lists/{list_id}/members/{subscriber_hash}")
    return {"message": f"Member {email} archived from list {list_id}"}


async def mailchimp_search_members(
    list_id: str,
    query: str,
    count: int = 20,
) -> Dict[str, Any]:
    """Search for members in a Mailchimp audience by email or name.

    Args:
        list_id: The Mailchimp audience/list ID.
        query: Search query string (email or name).
        count: Number of results to return.
    """
    client = await MailchimpClient.initialize(_auth())
    return await _request(client, "GET", "search-members",
                          params={"query": query, "list_id": list_id, "count": count})


# ---------------------------------------------------------------------------
# Campaigns
# ---------------------------------------------------------------------------

async def mailchimp_list_campaigns(
    status: Optional[str] = None,
    count: int = 20,
    offset: int = 0,
) -> Dict[str, Any]:
    """List Mailchimp email campaigns.

    Args:
        status: Filter by status: save, paused, schedule, sending, sent.
        count: Number of campaigns to return.
        offset: Pagination offset.
    """
    client = await MailchimpClient.initialize(_auth())
    params: Dict[str, Any] = {"count": count, "offset": offset}
    if status:
        params["status"] = status
    return await _request(client, "GET", "campaigns", params=params)


async def mailchimp_get_campaign(campaign_id: str) -> Dict[str, Any]:
    """Get details of a specific Mailchimp campaign.

    Args:
        campaign_id: The Mailchimp campaign ID.
    """
    client = await MailchimpClient.initialize(_auth())
    return await _request(client, "GET", f"campaigns/{campaign_id}")


async def mailchimp_create_campaign(
    list_id: str,
    subject_line: str,
    from_name: str,
    reply_to: str,
    campaign_type: str = "regular",
    preview_text: Optional[str] = None,
    title: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new Mailchimp email campaign.

    Args:
        list_id: Audience/list ID to send the campaign to.
        subject_line: Email subject line.
        from_name: Sender display name.
        reply_to: Reply-to email address.
        campaign_type: Campaign type: regular, plaintext, rss, variate.
        preview_text: Short preview/preheader text (max ~150 chars).
        title: Internal campaign title (optional).
    """
    client = await MailchimpClient.initialize(_auth())
    body: Dict[str, Any] = {
        "type": campaign_type,
        "recipients": {"list_id": list_id},
        "settings": {
            "subject_line": subject_line,
            "from_name": from_name,
            "reply_to": reply_to,
        },
    }
    if preview_text:
        body["settings"]["preview_text"] = preview_text
    if title:
        body["settings"]["title"] = title
    return await _request(client, "POST", "campaigns", json_body=body)


async def mailchimp_set_campaign_content(
    campaign_id: str,
    html: Optional[str] = None,
    plain_text: Optional[str] = None,
    template_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Set the HTML/text content for a Mailchimp campaign.

    Args:
        campaign_id: The Mailchimp campaign ID.
        html: Full HTML content for the campaign.
        plain_text: Plain-text version of the campaign.
        template_id: Mailchimp template ID to use instead of raw HTML.
    """
    client = await MailchimpClient.initialize(_auth())
    body: Dict[str, Any] = {}
    if html:
        body["html"] = html
    if plain_text:
        body["plain_text"] = plain_text
    if template_id:
        body["template"] = {"id": template_id}
    return await _request(client, "PUT", f"campaigns/{campaign_id}/content", json_body=body)


async def mailchimp_send_campaign(campaign_id: str) -> Dict[str, Any]:
    """Send a ready Mailchimp campaign immediately.

    Args:
        campaign_id: The Mailchimp campaign ID to send.
    """
    client = await MailchimpClient.initialize(_auth())
    await _request(client, "POST", f"campaigns/{campaign_id}/actions/send")
    return {"message": f"Campaign {campaign_id} sent successfully"}


async def mailchimp_schedule_campaign(
    campaign_id: str,
    schedule_time: str,
) -> Dict[str, Any]:
    """Schedule a Mailchimp campaign for a specific date/time.

    Args:
        campaign_id: The Mailchimp campaign ID.
        schedule_time: ISO 8601 datetime string e.g. "2025-06-01T10:00:00+00:00".
    """
    client = await MailchimpClient.initialize(_auth())
    await _request(client, "POST", f"campaigns/{campaign_id}/actions/schedule",
                   json_body={"schedule_time": schedule_time})
    return {"message": f"Campaign {campaign_id} scheduled for {schedule_time}"}


async def mailchimp_unschedule_campaign(campaign_id: str) -> Dict[str, Any]:
    """Unschedule a previously scheduled Mailchimp campaign.

    Args:
        campaign_id: The Mailchimp campaign ID.
    """
    client = await MailchimpClient.initialize(_auth())
    await _request(client, "POST", f"campaigns/{campaign_id}/actions/unschedule")
    return {"message": f"Campaign {campaign_id} unscheduled"}


async def mailchimp_delete_campaign(campaign_id: str) -> Dict[str, Any]:
    """Delete a Mailchimp campaign.

    Args:
        campaign_id: The Mailchimp campaign ID to delete.
    """
    client = await MailchimpClient.initialize(_auth())
    await _request(client, "DELETE", f"campaigns/{campaign_id}")
    return {"message": f"Campaign {campaign_id} deleted"}


# ---------------------------------------------------------------------------
# Campaign Reports / Stats
# ---------------------------------------------------------------------------

async def mailchimp_get_campaign_report(campaign_id: str) -> Dict[str, Any]:
    """Get performance statistics for a sent Mailchimp campaign.
    Returns opens, clicks, bounce rate, unsubscribe rate, and more.

    Args:
        campaign_id: The Mailchimp campaign ID.
    """
    client = await MailchimpClient.initialize(_auth())
    return await _request(client, "GET", f"reports/{campaign_id}")


async def mailchimp_list_campaign_reports(
    count: int = 20,
    offset: int = 0,
) -> Dict[str, Any]:
    """List reports for all sent Mailchimp campaigns.

    Args:
        count: Number of reports to return.
        offset: Pagination offset.
    """
    client = await MailchimpClient.initialize(_auth())
    return await _request(client, "GET", "reports", params={"count": count, "offset": offset})


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------

async def mailchimp_add_tags_to_member(
    list_id: str,
    email: str,
    tags: List[str],
) -> Dict[str, Any]:
    """Add tags to a Mailchimp audience member.

    Args:
        list_id: The Mailchimp audience/list ID.
        email: Member email address.
        tags: List of tag names to add.
    """
    import hashlib
    subscriber_hash = hashlib.md5(email.lower().encode()).hexdigest()
    client = await MailchimpClient.initialize(_auth())
    body = {"tags": [{"name": t, "status": "active"} for t in tags]}
    await _request(client, "POST", f"lists/{list_id}/members/{subscriber_hash}/tags", json_body=body)
    return {"message": f"Tags {tags} added to {email}"}


async def mailchimp_remove_tags_from_member(
    list_id: str,
    email: str,
    tags: List[str],
) -> Dict[str, Any]:
    """Remove tags from a Mailchimp audience member.

    Args:
        list_id: The Mailchimp audience/list ID.
        email: Member email address.
        tags: List of tag names to remove.
    """
    import hashlib
    subscriber_hash = hashlib.md5(email.lower().encode()).hexdigest()
    client = await MailchimpClient.initialize(_auth())
    body = {"tags": [{"name": t, "status": "inactive"} for t in tags]}
    await _request(client, "POST", f"lists/{list_id}/members/{subscriber_hash}/tags", json_body=body)
    return {"message": f"Tags {tags} removed from {email}"}
