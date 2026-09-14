from typing import Any, Dict, List, Optional

from fastmcp.server.dependencies import get_http_headers

from .client import HubspotClient
from .http import hubspot_request


_CORE_PROPERTY_NAMES: Dict[str, List[str]] = {
    "contacts": [
        "firstname",
        "lastname",
        "email",
        "phone",
        "mobilephone",
        "company",
        "jobtitle",
        "website",
        "lifecyclestage",
        "hubspot_owner_id",
        "createdate",
        "lastmodifieddate",
    ],
    "companies": [
        "name",
        "domain",
        "phone",
        "city",
        "state",
        "country",
        "industry",
        "numberofemployees",
        "website",
        "hubspot_owner_id",
        "createdate",
        "hs_lastmodifieddate",
    ],
    "deals": [
        "dealname",
        "amount",
        "dealstage",
        "pipeline",
        "closedate",
        "dealtype",
        "hubspot_owner_id",
        "createdate",
        "hs_lastmodifieddate",
    ],
    "tickets": [
        "subject",
        "content",
        "hs_ticket_priority",
        "hs_ticket_category",
        "hs_pipeline",
        "hs_pipeline_stage",
        "hubspot_owner_id",
        "createdate",
        "hs_lastmodifieddate",
    ],
}


def _compact_property_definition(prop: Dict[str, Any]) -> Dict[str, Any]:
    """Return a concise property payload suitable for tool responses."""
    return {
        "name": prop.get("name"),
        "label": prop.get("label"),
        "type": prop.get("type"),
        "fieldType": prop.get("fieldType"),
        "groupName": prop.get("groupName"),
        "description": prop.get("description"),
    }


def _select_main_properties(
    object_type: str, all_properties: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Prefer object-type core fields; fallback to important HubSpot-defined fields.
    """
    normalized_type = object_type.lower()
    target_names = _CORE_PROPERTY_NAMES.get(normalized_type, [])
    by_name = {
        prop.get("name"): prop
        for prop in all_properties
        if isinstance(prop, dict) and prop.get("name")
    }

    selected: List[Dict[str, Any]] = []
    for name in target_names:
        prop = by_name.get(name)
        if prop:
            selected.append(_compact_property_definition(prop))

    if selected:
        return selected

    # Fallback for custom/unknown objects: return concise top hubspotDefined fields.
    fallback = [
        _compact_property_definition(prop)
        for prop in all_properties
        if isinstance(prop, dict) and prop.get("hubspotDefined") is True
    ]
    if fallback:
        return fallback[:12]

    # Final fallback if the payload shape differs.
    return [
        _compact_property_definition(prop)
        for prop in all_properties
        if isinstance(prop, dict)
    ][:12]


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
    Batch upsert by a unique property (e.g. email for contacts).
    Each input: {"properties": {...}, "id_property_value": "..."}.
    HubSpot requires the id_property value at root level of each input.
    """
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)

    # HubSpot expects `idProperty` at each input item for batch upsert.
    upsert_inputs: List[Dict[str, Any]] = []
    for item in inputs[:100]:
        enriched = dict(item)
        enriched.setdefault("idProperty", id_property)
        upsert_inputs.append(enriched)

    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="POST",
        path=f"/crm/v3/objects/{object_type}/batch/upsert",
        json_body={"inputs": upsert_inputs},
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
    """List concise, main property definitions for an object type."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    raw_response = await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path=f"/crm/v3/properties/{object_type}",
        params={"archived": str(archived).lower()},
    )

    if isinstance(raw_response, dict):
        raw_results = raw_response.get("results")
        if isinstance(raw_results, list):
            return {
                "objectType": object_type,
                "archived": archived,
                "results": _select_main_properties(object_type, raw_results),
            }

    if isinstance(raw_response, list):
        return {
            "objectType": object_type,
            "archived": archived,
            "results": _select_main_properties(object_type, raw_response),
        }

    return {
        "objectType": object_type,
        "archived": archived,
        "results": [],
    }


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
