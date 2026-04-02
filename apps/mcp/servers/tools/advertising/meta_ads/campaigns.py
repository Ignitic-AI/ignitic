"""Meta Ads campaign create/update tools."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastmcp.exceptions import ToolError

from .client import MetaAdsClient, get_auth_from_headers


async def create_campaign(
    name: str,
    objective: str,
    account_id: Optional[str] = None,
    status: str = "PAUSED",
    special_ad_categories: Optional[List[str]] = None,
    buying_type: str = "AUCTION",
    daily_budget: Optional[int] = None,
    lifetime_budget: Optional[int] = None,
    bid_strategy: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a Meta Ads campaign."""
    auth = get_auth_from_headers()
    client = await MetaAdsClient.build(auth)

    resolved_account_id = client.require_account_id(account_id)

    if daily_budget is not None and lifetime_budget is not None:
        raise ToolError("Provide either daily_budget or lifetime_budget, not both.")

    params: Dict[str, Any] = {
        "name": name,
        "objective": objective,
        "status": status,
        "buying_type": buying_type,
        "special_ad_categories": json.dumps(special_ad_categories or []),
    }
    if daily_budget is not None:
        params["daily_budget"] = str(daily_budget)
    if lifetime_budget is not None:
        params["lifetime_budget"] = str(lifetime_budget)
    if bid_strategy:
        params["bid_strategy"] = bid_strategy

    return await client.request(
        "POST", f"{resolved_account_id}/campaigns", params=params
    )


async def update_campaign(
    campaign_id: str,
    status: Optional[str] = None,
    name: Optional[str] = None,
    daily_budget: Optional[int] = None,
    lifetime_budget: Optional[int] = None,
    bid_strategy: Optional[str] = None,
    special_ad_categories: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Update campaign status/budget/metadata."""
    auth = get_auth_from_headers()
    client = await MetaAdsClient.build(auth)

    if daily_budget is not None and lifetime_budget is not None:
        raise ToolError("Provide either daily_budget or lifetime_budget, not both.")

    params: Dict[str, Any] = {}
    if status:
        params["status"] = status
    if name:
        params["name"] = name
    if daily_budget is not None:
        params["daily_budget"] = str(daily_budget)
    if lifetime_budget is not None:
        params["lifetime_budget"] = str(lifetime_budget)
    if bid_strategy:
        params["bid_strategy"] = bid_strategy
    if special_ad_categories is not None:
        params["special_ad_categories"] = json.dumps(special_ad_categories)

    if not params:
        raise ToolError("No updates provided. Set at least one field to modify.")

    return await client.request("POST", campaign_id, params=params)
