"""Google Ads ad group (Meta ad set equivalent) create/update tools."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastmcp.exceptions import ToolError

from .client import GoogleAdsClient, get_auth_from_headers


async def create_ad_group(
    campaign_id: str,
    name: str,
    status: str = "ENABLED",
    ad_group_type: str = "SEARCH_STANDARD",
    cpc_bid_micros: Optional[int] = None,
) -> Dict[str, Any]:
    """Create an ad group under a campaign."""
    auth = get_auth_from_headers()
    client = await GoogleAdsClient.build(auth)
    resolved_customer_id = client.require_customer_id()

    ad_group_service = client.sdk_client.get_service("AdGroupService")
    campaign_service = client.sdk_client.get_service("CampaignService")
    operation = client.sdk_client.get_type("AdGroupOperation")

    ad_group = operation.create
    ad_group.name = name
    ad_group.status = getattr(client.sdk_client.enums.AdGroupStatusEnum, status)
    ad_group.type_ = getattr(client.sdk_client.enums.AdGroupTypeEnum, ad_group_type)
    ad_group.campaign = campaign_service.campaign_path(
        resolved_customer_id, campaign_id
    )

    if cpc_bid_micros is not None:
        ad_group.cpc_bid_micros = int(cpc_bid_micros)

    response = ad_group_service.mutate_ad_groups(
        customer_id=resolved_customer_id,
        operations=[operation],
    )

    return {
        "customer_id": resolved_customer_id,
        "resource_name": response.results[0].resource_name,
    }


async def update_ad_group(
    ad_group_id: str,
    name: Optional[str] = None,
    status: Optional[str] = None,
    cpc_bid_micros: Optional[int] = None,
) -> Dict[str, Any]:
    """Update mutable ad group fields."""
    if not any([name, status, cpc_bid_micros is not None]):
        raise ToolError("No updates provided. Set at least one field to modify.")

    auth = get_auth_from_headers()
    client = await GoogleAdsClient.build(auth)
    resolved_customer_id = client.require_customer_id()

    ad_group_service = client.sdk_client.get_service("AdGroupService")
    operation = client.sdk_client.get_type("AdGroupOperation")

    ad_group = operation.update
    ad_group.resource_name = ad_group_service.ad_group_path(
        resolved_customer_id, ad_group_id
    )

    update_paths = []
    if name:
        ad_group.name = name
        update_paths.append("name")
    if status:
        ad_group.status = getattr(client.sdk_client.enums.AdGroupStatusEnum, status)
        update_paths.append("status")
    if cpc_bid_micros is not None:
        ad_group.cpc_bid_micros = int(cpc_bid_micros)
        update_paths.append("cpc_bid_micros")

    operation.update_mask.paths.extend(update_paths)

    response = ad_group_service.mutate_ad_groups(
        customer_id=resolved_customer_id,
        operations=[operation],
    )

    return {
        "customer_id": resolved_customer_id,
        "resource_name": response.results[0].resource_name,
        "updated_fields": update_paths,
    }
