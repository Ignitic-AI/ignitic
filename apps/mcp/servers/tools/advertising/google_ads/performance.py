"""Google Ads performance/insights tools."""

from __future__ import annotations

from typing import Any, Dict

from .client import GoogleAdsClient, get_auth_from_headers


async def get_performance_metrics(
    level: str = "campaign",
    start_date: str = "2026-01-01",
    end_date: str = "2026-01-31",
    limit: int = 200,
) -> Dict[str, Any]:
    """Get metrics for campaign, ad_group, or ad between two dates."""
    auth = get_auth_from_headers()
    client = await GoogleAdsClient.build(auth)
    resolved_customer_id = client.require_customer_id()

    level = level.lower().strip()
    if level == "campaign":
        select_clause = """
          campaign.id,
          campaign.name,
          campaign.status,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        """
        from_clause = "campaign"
    elif level == "ad_group":
        select_clause = """
          campaign.id,
          campaign.name,
          ad_group.id,
          ad_group.name,
          ad_group.status,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        """
        from_clause = "ad_group"
    else:
        select_clause = """
          campaign.id,
          campaign.name,
          ad_group.id,
          ad_group.name,
          ad_group_ad.ad.id,
          ad_group_ad.ad.name,
          ad_group_ad.status,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        """
        from_clause = "ad_group_ad"

    google_ads_service = client.sdk_client.get_service("GoogleAdsService")
    query = f"""
        SELECT
          {select_clause}
        FROM {from_clause}
        WHERE segments.date >= '{start_date}'
          AND segments.date <= '{end_date}'
        LIMIT {max(1, min(limit, 10000))}
    """

    rows = google_ads_service.search(customer_id=resolved_customer_id, query=query)
    items = []
    for row in rows:
        payload = {
            "campaign_id": str(row.campaign.id),
            "campaign_name": row.campaign.name,
            "impressions": int(row.metrics.impressions),
            "clicks": int(row.metrics.clicks),
            "cost_micros": int(row.metrics.cost_micros),
            "conversions": float(row.metrics.conversions),
            "ctr": float(row.metrics.ctr),
            "average_cpc": float(row.metrics.average_cpc),
        }

        if level in {"ad_group", "ad"}:
            payload["ad_group_id"] = str(row.ad_group.id)
            payload["ad_group_name"] = row.ad_group.name
        if level == "ad":
            payload["ad_id"] = str(row.ad_group_ad.ad.id)
            payload["ad_name"] = row.ad_group_ad.ad.name
            payload["ad_status"] = row.ad_group_ad.status.name

        items.append(payload)

    return {
        "customer_id": resolved_customer_id,
        "level": level,
        "start_date": start_date,
        "end_date": end_date,
        "items": items,
    }
