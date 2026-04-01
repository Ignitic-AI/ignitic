"""
HubSpot REST helpers beyond core CRM object CRUD — lists, files, forms, preferences, etc.
All use the same Private App Bearer token as other HubSpot tools. Scopes must be enabled on the private app.
"""

from typing import Any, Dict, List, Optional
from urllib.parse import quote

from fastmcp.server.dependencies import get_http_headers

from .client import HubspotClient
from .http import hubspot_request


def _auth_from_headers() -> str:
    headers = get_http_headers()
    auth = headers.get("Authorization") or headers.get("authorization")
    if not auth:
        raise ValueError("Authorization header is required")
    return auth


async def hubspot_companies_merge(
    primary_object_id: str,
    object_id_to_merge: str,
) -> Dict[str, Any]:
    """Merge two company records (same pattern as contact merge)."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="POST",
        path="/crm/v3/objects/companies/merge",
        json_body={
            "primaryObjectId": primary_object_id,
            "objectIdToMerge": object_id_to_merge,
        },
    )


async def hubspot_lists_search(
    offset: int = 0,
    count: int = 50,
    query: Optional[str] = None,
    object_type_id: Optional[str] = None,
    list_ids: Optional[List[str]] = None,
    processing_types: Optional[List[str]] = None,
    additional_properties: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Search CRM marketing lists (segments). Empty query returns all lists (paginated).
    Requires crm.lists.read on the private app.
    """
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    body: Dict[str, Any] = {
        "additionalProperties": additional_properties or [],
        "offset": offset,
        "count": min(count, 500),
    }
    if query is not None:
        body["query"] = query
    if object_type_id:
        body["objectTypeId"] = object_type_id
    if list_ids:
        body["listIds"] = list_ids
    if processing_types:
        body["processingTypes"] = processing_types
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="POST",
        path="/crm/v3/lists/search",
        json_body=body,
    )


async def hubspot_list_get(list_id: str) -> Dict[str, Any]:
    """Get one list by ILS list id."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path=f"/crm/v3/lists/{list_id}",
    )


async def hubspot_list_memberships_join_order(
    list_id: str,
    limit: int = 100,
    after: Optional[str] = None,
    before: Optional[str] = None,
) -> Dict[str, Any]:
    """List record ids in a list ordered by time added (paginated)."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    params: Dict[str, Any] = {"limit": min(limit, 250)}
    if after:
        params["after"] = after
    if before:
        params["before"] = before
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path=f"/crm/v3/lists/{list_id}/memberships/join-order",
        params=params,
    )


async def hubspot_list_memberships_add_remove(
    list_id: str,
    record_ids_to_add: Optional[List[str]] = None,
    record_ids_to_remove: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Add/remove CRM records on a MANUAL or SNAPSHOT list. Use HubSpot record object ids.
    Requires crm.lists.write.
    """
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    body = {
        "recordIdsToAdd": record_ids_to_add or [],
        "recordIdsToRemove": record_ids_to_remove or [],
    }
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="PUT",
        path=f"/crm/v3/lists/{list_id}/memberships/add-and-remove",
        json_body=body,
    )


async def hubspot_list_record_memberships(
    object_type_id: str,
    record_id: str,
) -> Dict[str, Any]:
    """
    Lists a CRM record is a member of. object_type_id is HubSpot's id (e.g. 0-1 contacts, 0-2 companies).
    """
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path=f"/crm/v3/lists/records/{object_type_id}/{record_id}/memberships",
    )


async def hubspot_files_search(
    parent_folder_id: Optional[str] = None,
    path: Optional[str] = None,
    after: Optional[str] = None,
    limit: int = 50,
    name: Optional[str] = None,
) -> Dict[str, Any]:
    """Search files in the file manager (GET /files/v3/files/search). Requires files scope."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    params: Dict[str, Any] = {}
    if parent_folder_id:
        params["parentFolderId"] = parent_folder_id
    if path:
        params["path"] = path
    if after:
        params["after"] = after
    if name:
        params["name"] = name
    params["limit"] = min(limit, 100)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path="/files/v3/files/search",
        params=params or None,
    )


async def hubspot_file_get(file_id: str) -> Dict[str, Any]:
    """Get file metadata by HubSpot file id."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path=f"/files/v3/files/{file_id}",
    )


async def hubspot_folder_get(folder_id: str) -> Dict[str, Any]:
    """Get folder metadata by HubSpot folder id."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path=f"/files/v3/folders/{folder_id}",
    )


async def hubspot_forms_list() -> Dict[str, Any]:
    """List non-HubSpot-form legacy forms (v2). Requires forms scope on the private app."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path="/forms/v2/forms",
    )


async def hubspot_communication_preferences_definitions(
    business_unit_id: Optional[int] = None,
    include_translations: bool = False,
) -> Dict[str, Any]:
    """Subscription type definitions (email/SMS preferences). Requires communication_preferences.read."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    params: Dict[str, Any] = {"includeTranslations": str(include_translations).lower()}
    if business_unit_id is not None:
        params["businessUnitId"] = business_unit_id
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path="/communication-preferences/v4/definitions",
        params=params,
    )


async def hubspot_communication_preferences_statuses_get(
    subscriber_id_string: str,
) -> Dict[str, Any]:
    """
    Subscription status for a subscriber id (often contact email or HubSpot subscriber string).
    GET /communication-preferences/v4/statuses/{subscriberIdString}
    """
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    safe = quote(subscriber_id_string, safe="")
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path=f"/communication-preferences/v4/statuses/{safe}",
    )


async def hubspot_crm_pipelines_list(object_type: str) -> Dict[str, Any]:
    """
    List pipelines for a CRM object type: e.g. deals, tickets, quotes, leads (HubSpot product dependent).
    Complements deal/ticket-specific pipeline tools.
    """
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    ot = object_type.strip().lower()
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path=f"/crm/v3/pipelines/{ot}",
    )


async def hubspot_marketing_emails_list(
    limit: int = 20,
    after: Optional[str] = None,
) -> Dict[str, Any]:
    """
    List marketing emails (campaign assets). Requires marketing-email or equivalent scope.
    """
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    params: Dict[str, Any] = {"limit": min(limit, 100)}
    if after:
        params["after"] = after
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path="/marketing/v3/emails",
        params=params,
    )
