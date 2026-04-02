"""Meta Ads creative management tools."""

from __future__ import annotations

import json
from typing import Any, Dict, Optional

from fastmcp.exceptions import ToolError

from .client import MetaAdsClient, get_auth_from_headers


async def create_ad_creative(
    name: str,
    page_id: str,
    link_url: str,
    message: str,
    account_id: Optional[str] = None,
    headline: Optional[str] = None,
    description: Optional[str] = None,
    image_hash: Optional[str] = None,
    call_to_action_type: str = "LEARN_MORE",
    instagram_actor_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Create an ad creative with a link-based story spec."""
    auth = get_auth_from_headers()
    client = await MetaAdsClient.build(auth)

    resolved_account_id = client.require_account_id(account_id)

    link_data: Dict[str, Any] = {
        "link": link_url,
        "message": message,
        "call_to_action": {
            "type": call_to_action_type,
            "value": {"link": link_url},
        },
    }
    if headline:
        link_data["name"] = headline
    if description:
        link_data["description"] = description
    if image_hash:
        link_data["image_hash"] = image_hash

    object_story_spec: Dict[str, Any] = {
        "page_id": page_id,
        "link_data": link_data,
    }
    if instagram_actor_id:
        object_story_spec["instagram_actor_id"] = instagram_actor_id

    params: Dict[str, Any] = {
        "name": name,
        "object_story_spec": json.dumps(object_story_spec),
    }

    return await client.request(
        "POST", f"{resolved_account_id}/adcreatives", params=params
    )


async def update_ad_creative(
    creative_id: str,
    name: Optional[str] = None,
    message: Optional[str] = None,
    headline: Optional[str] = None,
    description: Optional[str] = None,
    call_to_action_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Update mutable fields on an existing creative."""
    auth = get_auth_from_headers()
    client = await MetaAdsClient.build(auth)

    if not any([name, message, headline, description, call_to_action_type]):
        raise ToolError("No updates provided. Set at least one field to modify.")

    params: Dict[str, Any] = {}
    if name:
        params["name"] = name

    # Graph API accepts object_story_spec updates for creative text changes.
    if any([message, headline, description, call_to_action_type]):
        # We send only supported link_data text updates.
        link_data: Dict[str, Any] = {}
        if message:
            link_data["message"] = message
        if headline:
            link_data["name"] = headline
        if description:
            link_data["description"] = description
        if call_to_action_type:
            link_data["call_to_action"] = {"type": call_to_action_type}

        params["object_story_spec"] = json.dumps({"link_data": link_data})

    return await client.request("POST", creative_id, params=params)
