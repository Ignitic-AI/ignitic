"""Meta Ads ad set create/update tools."""

from __future__ import annotations

import json
from typing import Any, Dict, Optional

from fastmcp.exceptions import ToolError

from .client import MetaAdsClient, get_auth_from_headers


async def create_adset(
    campaign_id: str,
    name: str,
    account_id: Optional[str] = None,
    status: str = "PAUSED",
    daily_budget: Optional[int] = None,
    lifetime_budget: Optional[int] = None,
    targeting: Optional[Dict[str, Any]] = None,
    optimization_goal: Optional[str] = None,
    billing_event: Optional[str] = None,
    bid_amount: Optional[int] = None,
    bid_strategy: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
) -> Dict[str, Any]:
    """Create an ad set under a campaign."""
    auth = get_auth_from_headers()
    client = await MetaAdsClient.build(auth)

    resolved_account_id = client.require_account_id(account_id)

    if daily_budget is not None and lifetime_budget is not None:
        raise ToolError("Provide either daily_budget or lifetime_budget, not both.")

    params: Dict[str, Any] = {
        "campaign_id": campaign_id,
        "name": name,
        "status": status,
    }
    if daily_budget is not None:
        params["daily_budget"] = str(daily_budget)
    if lifetime_budget is not None:
        params["lifetime_budget"] = str(lifetime_budget)
    if targeting is not None:
        params["targeting"] = json.dumps(targeting)
    if optimization_goal:
        params["optimization_goal"] = optimization_goal
    if billing_event:
        params["billing_event"] = billing_event
    if bid_amount is not None:
        params["bid_amount"] = str(bid_amount)
    if bid_strategy:
        params["bid_strategy"] = bid_strategy
    if start_time:
        params["start_time"] = start_time
    if end_time:
        params["end_time"] = end_time

    return await client.request("POST", f"{resolved_account_id}/adsets", params=params)


async def update_adset(
    adset_id: str,
    status: Optional[str] = None,
    name: Optional[str] = None,
    daily_budget: Optional[int] = None,
    lifetime_budget: Optional[int] = None,
    targeting: Optional[Dict[str, Any]] = None,
    bid_amount: Optional[int] = None,
    bid_strategy: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
) -> Dict[str, Any]:
    """Update ad set settings."""
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
    if targeting is not None:
        params["targeting"] = json.dumps(targeting)
    if bid_amount is not None:
        params["bid_amount"] = str(bid_amount)
    if bid_strategy:
        params["bid_strategy"] = bid_strategy
    if start_time:
        params["start_time"] = start_time
    if end_time:
        params["end_time"] = end_time

    if not params:
        raise ToolError("No updates provided. Set at least one field to modify.")

    return await client.request("POST", adset_id, params=params)
