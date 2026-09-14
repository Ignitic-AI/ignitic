"""Meta Ads monitoring and insights tools."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .client import MetaAdsClient, get_auth_from_headers


async def get_insights(
    object_id: str,
    level: str = "campaign",
    date_preset: str = "last_30d",
    fields: Optional[List[str]] = None,
    breakdown: Optional[str] = None,
    time_range: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Retrieve delivery/performance metrics for account/campaign/adset/ad.

    Args:
        object_id: Graph object ID to query insights for.
        level: Aggregation level (account, campaign, adset, ad).
        date_preset: Standard Meta date preset when time_range is not provided.
        fields: Optional metrics field list. A practical default is applied.
        breakdown: Optional single breakdown dimension (age, gender, country, etc.).
        time_range: Optional explicit date range: {"since": "YYYY-MM-DD", "until": "YYYY-MM-DD"}
    """
    auth = get_auth_from_headers()
    client = await MetaAdsClient.build(auth)

    selected_fields = fields or [
        "campaign_id",
        "campaign_name",
        "adset_id",
        "adset_name",
        "ad_id",
        "ad_name",
        "impressions",
        "reach",
        "clicks",
        "spend",
        "ctr",
        "cpc",
        "cpm",
        "actions",
        "cost_per_action_type",
    ]

    params: Dict[str, Any] = {
        "level": level,
        "fields": ",".join(selected_fields),
        "limit": 500,
    }

    if time_range:
        params["time_range"] = json.dumps(time_range)
    else:
        params["date_preset"] = date_preset

    if breakdown:
        params["breakdowns"] = breakdown

    return await client.request("GET", f"{object_id}/insights", params=params)
