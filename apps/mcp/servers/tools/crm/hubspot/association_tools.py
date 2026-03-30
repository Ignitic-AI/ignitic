from typing import Any, Dict, List

from fastmcp.server.dependencies import get_http_headers

from .client import HubspotClient
from .http import hubspot_request


def _auth_from_headers() -> str:
    headers = get_http_headers()
    auth = headers.get("Authorization") or headers.get("authorization")
    if not auth:
        raise ValueError("Authorization header is required")
    return auth


async def hubspot_association_labels_list(
    from_object_type: str,
    to_object_type: str,
) -> Dict[str, Any]:
    """List association labels / type ids between two object types (CRM v4)."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="GET",
        path=f"/crm/v4/associations/{from_object_type}/{to_object_type}/labels",
    )


async def hubspot_associations_create_batch(
    from_object_type: str,
    to_object_type: str,
    inputs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Batch create associations (v4). inputs use from/to ids and type or types[].
    """
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="POST",
        path=f"/crm/v4/associations/{from_object_type}/{to_object_type}/batch/create",
        json_body={"inputs": inputs[:100]},
    )


async def hubspot_associations_read_batch(
    from_object_type: str,
    to_object_type: str,
    inputs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Batch read associations from object ids. inputs: [{"id": "..."}]."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="POST",
        path=f"/crm/v4/associations/{from_object_type}/{to_object_type}/batch/read",
        json_body={"inputs": inputs[:100]},
    )


async def hubspot_associations_archive_batch(
    from_object_type: str,
    to_object_type: str,
    inputs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Batch remove associations (v4 archive)."""
    auth = _auth_from_headers()
    client = await HubspotClient.initialize(auth)
    return await hubspot_request(
        base_url=client.base_url,
        access_token=client.access_token,
        method="POST",
        path=f"/crm/v4/associations/{from_object_type}/{to_object_type}/batch/archive",
        json_body={"inputs": inputs[:100]},
    )
