"""Meta Ads ad create/update tools."""

from __future__ import annotations

import json
from typing import Any, Dict, Optional

from fastmcp.exceptions import ToolError

from .client import MetaAdsClient, get_auth_from_headers


async def create_ad(
    name: str,
    adset_id: str,
    creative_id: str,
    account_id: Optional[str] = None,
    status: str = "PAUSED",
    bid_amount: Optional[int] = None,
) -> Dict[str, Any]:
    """Create an ad under an ad set using an existing creative."""
    auth = get_auth_from_headers()
    client = await MetaAdsClient.build(auth)

    resolved_account_id = client.require_account_id(account_id)

    params: Dict[str, Any] = {
        "name": name,
        "adset_id": adset_id,
        "creative": json.dumps({"creative_id": creative_id}),
        "status": status,
    }
    if bid_amount is not None:
        params["bid_amount"] = str(bid_amount)

    return await client.request("POST", f"{resolved_account_id}/ads", params=params)


async def update_ad(
    ad_id: str,
    status: Optional[str] = None,
    name: Optional[str] = None,
    bid_amount: Optional[int] = None,
) -> Dict[str, Any]:
    """Update ad status/name/bid."""
    auth = get_auth_from_headers()
    client = await MetaAdsClient.build(auth)

    params: Dict[str, Any] = {}
    if status:
        params["status"] = status
    if name:
        params["name"] = name
    if bid_amount is not None:
        params["bid_amount"] = str(bid_amount)

    if not params:
        raise ToolError("No updates provided. Set at least one field to modify.")

    return await client.request("POST", ad_id, params=params)
