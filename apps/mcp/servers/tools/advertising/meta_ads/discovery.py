"""Meta Ads discovery and listing tools."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .client import MetaAdsClient, get_auth_from_headers


async def get_ad_accounts(user_id: str = "me", limit: int = 50) -> Dict[str, Any]:
    """List ad accounts available to the authenticated user."""
    auth = get_auth_from_headers()
    client = await MetaAdsClient.build(auth)

    params = {
        "limit": min(max(limit, 1), 200),
        "fields": "id,account_id,name,account_status,currency,timezone_name,business_name",
    }
    return await client.request("GET", f"{user_id}/adaccounts", params=params)


async def get_campaigns(
    account_id: Optional[str] = None,
    limit: int = 25,
    status_filter: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """List campaigns for an ad account."""
    auth = get_auth_from_headers()
    client = await MetaAdsClient.build(auth)

    resolved_account_id = client.require_account_id(account_id)
    params: Dict[str, Any] = {
        "limit": min(max(limit, 1), 200),
        "fields": "id,name,status,objective,effective_status,daily_budget,lifetime_budget,start_time,stop_time,updated_time",
    }
    if status_filter:
        params["effective_status"] = json.dumps(status_filter)

    return await client.request(
        "GET", f"{resolved_account_id}/campaigns", params=params
    )


async def get_adsets(
    account_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    limit: int = 25,
) -> Dict[str, Any]:
    """List ad sets for an ad account, optionally filtered by campaign."""
    auth = get_auth_from_headers()
    client = await MetaAdsClient.build(auth)

    resolved_account_id = client.require_account_id(account_id)
    params: Dict[str, Any] = {
        "limit": min(max(limit, 1), 200),
        "fields": "id,name,status,campaign_id,daily_budget,lifetime_budget,bid_strategy,optimization_goal,billing_event,start_time,end_time,updated_time",
    }
    if campaign_id:
        params["filtering"] = json.dumps(
            [{"field": "campaign.id", "operator": "EQUAL", "value": campaign_id}]
        )

    return await client.request("GET", f"{resolved_account_id}/adsets", params=params)


async def get_ads(
    account_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    adset_id: Optional[str] = None,
    limit: int = 25,
) -> Dict[str, Any]:
    """List ads for an ad account, with optional campaign/adset filters."""
    auth = get_auth_from_headers()
    client = await MetaAdsClient.build(auth)

    resolved_account_id = client.require_account_id(account_id)

    filters = []
    if campaign_id:
        filters.append(
            {"field": "campaign.id", "operator": "EQUAL", "value": campaign_id}
        )
    if adset_id:
        filters.append({"field": "adset.id", "operator": "EQUAL", "value": adset_id})

    params: Dict[str, Any] = {
        "limit": min(max(limit, 1), 200),
        "fields": "id,name,status,effective_status,campaign_id,adset_id,creative,updated_time",
    }
    if filters:
        params["filtering"] = json.dumps(filters)

    return await client.request("GET", f"{resolved_account_id}/ads", params=params)
