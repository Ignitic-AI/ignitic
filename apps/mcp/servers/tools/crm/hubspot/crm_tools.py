from typing import Any, Dict, List, Optional

from fastmcp.server.dependencies import get_http_headers

from .client import HubspotClient
from .http import hubspot_request


def _auth_from_headers() -> str:
    headers = get_http_headers()
    auth = headers.get("Authorization") or headers.get("authorization")
    if not auth:
        raise ValueError("Authorization header is required")
    return auth


async def hubspot_crm_search(
    object_type: str,
    filter_groups: Optional[List[Dict[str, Any]]] = None,
    sorts: Optional[List[Dict[str, str]]] = None,
    properties: Optional[List[str]] = None,
    properties_with_history: Optional[List[str]] = None,
    limit: int = 50,
    after: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Search CRM records (contacts, companies, deals, tickets, notes, custom objects).

    sorts: [{"propertyName": "createdate", "direction": "DESCENDING"}]
    filter_groups: [{"filters": [{"propertyName": "email", "operator": "EQ", "value": "x@y.com"}]}]
    """
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    body: Dict[str, Any] = {"limit": min(limit, 100)}
    if filter_groups:
        body["filterGroups"] = filter_groups
    if sorts:
        body["sorts"] = sorts
    if properties:
        body["properties"] = properties
    if properties_with_history:
        body["propertiesWithHistory"] = properties_with_history
    if after:
        body["after"] = after
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="POST",
        path=f"/crm/v3/objects/{object_type}/search",
        json_body=body,
    )


async def hubspot_crm_get(
    object_type: str,
    object_id: str,
    properties: Optional[List[str]] = None,
    properties_with_history: Optional[List[str]] = None,
    associations: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Read one CRM object by id."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    params: Dict[str, Any] = {}
    if properties:
        params["properties"] = ",".join(properties)
    if properties_with_history:
        params["propertiesWithHistory"] = ",".join(properties_with_history)
    if associations:
        params["associations"] = ",".join(associations)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path=f"/crm/v3/objects/{object_type}/{object_id}",
        params=params or None,
    )


async def hubspot_crm_create(
    object_type: str,
    properties: Dict[str, Any],
    associations: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Create a CRM record."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    body: Dict[str, Any] = {"properties": properties}
    if associations:
        body["associations"] = associations
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="POST",
        path=f"/crm/v3/objects/{object_type}",
        json_body=body,
    )


async def hubspot_crm_update(
    object_type: str,
    object_id: str,
    properties: Dict[str, Any],
) -> Dict[str, Any]:
    """Patch properties on a CRM object."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="PATCH",
        path=f"/crm/v3/objects/{object_type}/{object_id}",
        json_body={"properties": properties},
    )


async def hubspot_crm_archive(object_type: str, object_id: str) -> Dict[str, Any]:
    """Archive (soft-delete) a CRM object."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="DELETE",
        path=f"/crm/v3/objects/{object_type}/{object_id}",
    )


async def hubspot_crm_batch_read(
    object_type: str,
    object_ids: List[str],
    properties: Optional[List[str]] = None,
    properties_with_history: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Batch read up to 100 objects by id."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    body: Dict[str, Any] = {"inputs": [{"id": oid} for oid in object_ids[:100]]}
    if properties:
        body["properties"] = properties
    if properties_with_history:
        body["propertiesWithHistory"] = properties_with_history
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="POST",
        path=f"/crm/v3/objects/{object_type}/batch/read",
        json_body=body,
    )


async def hubspot_crm_batch_create(
    object_type: str,
    inputs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Batch create. Each input: {"properties": {...}, ...}."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="POST",
        path=f"/crm/v3/objects/{object_type}/batch/create",
        json_body={"inputs": inputs[:100]},
    )


async def hubspot_crm_batch_update(
    object_type: str,
    inputs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Batch update. Each input: {"id": "...", "properties": {...}}."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="POST",
        path=f"/crm/v3/objects/{object_type}/batch/update",
        json_body={"inputs": inputs[:100]},
    )


async def hubspot_crm_batch_archive(
    object_type: str,
    object_ids: List[str],
) -> Dict[str, Any]:
    """Batch archive objects."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="POST",
        path=f"/crm/v3/objects/{object_type}/batch/archive",
        json_body={"inputs": [{"id": oid} for oid in object_ids[:100]]},
    )


async def hubspot_crm_batch_upsert(
    object_type: str,
    id_property: str,
    inputs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Batch upsert by a unique property (e.g. email for contacts). Each input: {"properties": {...}}.
    HubSpot matches on id_property value inside properties.
    """
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="POST",
        path=f"/crm/v3/objects/{object_type}/batch/upsert",
        json_body={"inputs": inputs[:100], "idProperty": id_property},
    )


async def hubspot_contacts_merge(
    primary_object_id: str,
    object_id_to_merge: str,
) -> Dict[str, Any]:
    """Merge two contacts into one."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="POST",
        path="/crm/v3/objects/contacts/merge",
        json_body={
            "primaryObjectId": primary_object_id,
            "objectIdToMerge": object_id_to_merge,
        },
    )


async def hubspot_owners_list(
    email: Optional[str] = None,
    limit: int = 100,
    after: Optional[str] = None,
) -> Dict[str, Any]:
    """List HubSpot owners (users) for owner assignment fields."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    params: Dict[str, Any] = {"limit": min(limit, 500)}
    if email:
        params["email"] = email
    if after:
        params["after"] = after
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path="/crm/v3/owners",
        params=params,
    )


async def hubspot_crm_properties_list(
    object_type: str,
    archived: bool = False,
) -> Dict[str, Any]:
    """List property definitions for an object type (build filters & payloads)."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path=f"/crm/v3/properties/{object_type}",
        params={"archived": str(archived).lower()},
    )


async def hubspot_deal_pipelines() -> Dict[str, Any]:
    """List deal pipelines and stages."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path="/crm/v3/pipelines/deals",
    )


async def hubspot_ticket_pipelines() -> Dict[str, Any]:
    """List ticket pipelines and stages."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path="/crm/v3/pipelines/tickets",
    )


async def hubspot_custom_object_schemas() -> Dict[str, Any]:
    """List custom object schemas (objectTypeId, name)."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path="/crm/v3/schemas",
    )
