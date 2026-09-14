"""Google Ads discovery/list tools."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .client import GoogleAdsClient, get_auth_from_headers


async def list_accessible_customers() -> Dict[str, Any]:
    """List customer resource names accessible with current OAuth identity."""
    auth = get_auth_from_headers()
    client = await GoogleAdsClient.build(auth)

    customer_service = client.sdk_client.get_service("CustomerService")
    response = customer_service.list_accessible_customers()

    return {"resource_names": list(response.resource_names)}


async def get_campaigns(limit: int = 100) -> Dict[str, Any]:
    """List campaigns for a Google Ads customer."""
    auth = get_auth_from_headers()
    client = await GoogleAdsClient.build(auth)
    resolved_customer_id = client.require_customer_id()

    google_ads_service = client.sdk_client.get_service("GoogleAdsService")
    query = f"""
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          campaign.campaign_budget
        FROM campaign
        ORDER BY campaign.id DESC
        LIMIT {max(1, min(limit, 1000))}
    """

    rows = google_ads_service.search(customer_id=resolved_customer_id, query=query)
    campaigns = []
    for row in rows:
        campaigns.append(
            {
                "id": str(row.campaign.id),
                "name": row.campaign.name,
                "status": row.campaign.status.name,
                "channel_type": row.campaign.advertising_channel_type.name,
                "campaign_budget": row.campaign.campaign_budget,
            }
        )

    return {"customer_id": resolved_customer_id, "campaigns": campaigns}


async def get_ad_groups(
    campaign_id: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """List ad groups for a customer, optionally scoped to one campaign."""
    auth = get_auth_from_headers()
    client = await GoogleAdsClient.build(auth)
    resolved_customer_id = client.require_customer_id()

    campaign_clause = ""
    if campaign_id:
        campaign_clause = f"AND campaign.id = {int(campaign_id)}"

    google_ads_service = client.sdk_client.get_service("GoogleAdsService")
    query = f"""
        SELECT
          ad_group.id,
          ad_group.name,
          ad_group.status,
          ad_group.type,
          ad_group.campaign,
          campaign.id,
          campaign.name
        FROM ad_group
        WHERE ad_group.id > 0
          {campaign_clause}
        ORDER BY ad_group.id DESC
        LIMIT {max(1, min(limit, 1000))}
    """

    rows = google_ads_service.search(customer_id=resolved_customer_id, query=query)
    ad_groups = []
    for row in rows:
        ad_groups.append(
            {
                "id": str(row.ad_group.id),
                "name": row.ad_group.name,
                "status": row.ad_group.status.name,
                "type": row.ad_group.type_.name,
                "campaign_id": str(row.campaign.id),
                "campaign_name": row.campaign.name,
            }
        )

    return {"customer_id": resolved_customer_id, "ad_groups": ad_groups}


async def get_ads(
    campaign_id: Optional[str] = None,
    ad_group_id: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """List ads (ad_group_ad) for a customer with optional filters."""
    auth = get_auth_from_headers()
    client = await GoogleAdsClient.build(auth)
    resolved_customer_id = client.require_customer_id()

    filters = ["ad_group_ad.ad.id > 0"]
    if campaign_id:
        filters.append(f"campaign.id = {int(campaign_id)}")
    if ad_group_id:
        filters.append(f"ad_group.id = {int(ad_group_id)}")

    google_ads_service = client.sdk_client.get_service("GoogleAdsService")
    query = f"""
        SELECT
          ad_group_ad.ad.id,
          ad_group_ad.ad.name,
          ad_group_ad.status,
          ad_group.id,
          ad_group.name,
          campaign.id,
          campaign.name,
          ad_group_ad.ad.type,
          ad_group_ad.resource_name
        FROM ad_group_ad
        WHERE {" AND ".join(filters)}
        ORDER BY ad_group_ad.ad.id DESC
        LIMIT {max(1, min(limit, 1000))}
    """

    rows = google_ads_service.search(customer_id=resolved_customer_id, query=query)
    ads = []
    for row in rows:
        ads.append(
            {
                "ad_id": str(row.ad_group_ad.ad.id),
                "name": row.ad_group_ad.ad.name,
                "status": row.ad_group_ad.status.name,
                "ad_type": row.ad_group_ad.ad.type_.name,
                "resource_name": row.ad_group_ad.resource_name,
                "ad_group_id": str(row.ad_group.id),
                "ad_group_name": row.ad_group.name,
                "campaign_id": str(row.campaign.id),
                "campaign_name": row.campaign.name,
            }
        )

    return {"customer_id": resolved_customer_id, "ads": ads}


async def get_creatives(limit: int = 100) -> Dict[str, Any]:
    """List assets that can be used as creatives."""
    auth = get_auth_from_headers()
    client = await GoogleAdsClient.build(auth)
    resolved_customer_id = client.require_customer_id()

    google_ads_service = client.sdk_client.get_service("GoogleAdsService")
    query = f"""
        SELECT
          asset.id,
          asset.name,
          asset.type,
          asset.resource_name,
          asset.text_asset.text,
          asset.image_asset.full_size.url
        FROM asset
        ORDER BY asset.id DESC
        LIMIT {max(1, min(limit, 1000))}
    """

    rows = google_ads_service.search(customer_id=resolved_customer_id, query=query)
    creatives = []
    for row in rows:
        creatives.append(
            {
                "id": str(row.asset.id),
                "name": row.asset.name,
                "type": row.asset.type_.name,
                "resource_name": row.asset.resource_name,
                "text": row.asset.text_asset.text,
                "image_url": row.asset.image_asset.full_size.url,
            }
        )

    return {"customer_id": resolved_customer_id, "creatives": creatives}
