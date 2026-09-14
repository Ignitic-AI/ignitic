"""Google Ads ad create/update tools."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastmcp.exceptions import ToolError

from .client import GoogleAdsClient, get_auth_from_headers


def _set_responsive_search_ad(
    ad, headlines: List[str], descriptions: List[str]
) -> None:
    for value in headlines:
        if value.strip():
            asset = ad.responsive_search_ad.headlines.add()
            asset.text = value.strip()
    for value in descriptions:
        if value.strip():
            asset = ad.responsive_search_ad.descriptions.add()
            asset.text = value.strip()


async def create_ad(
    ad_group_id: str,
    name: str,
    final_urls: List[str],
    headlines: List[str],
    descriptions: List[str],
    status: str = "PAUSED",
) -> Dict[str, Any]:
    """Create a responsive search ad in an ad group."""
    if not final_urls:
        raise ToolError("final_urls must contain at least one URL.")
    if not headlines:
        raise ToolError("headlines must contain at least one value.")
    if not descriptions:
        raise ToolError("descriptions must contain at least one value.")

    auth = get_auth_from_headers()
    client = await GoogleAdsClient.build(auth)
    resolved_customer_id = client.require_customer_id()

    ad_group_ad_service = client.sdk_client.get_service("AdGroupAdService")
    ad_group_service = client.sdk_client.get_service("AdGroupService")
    operation = client.sdk_client.get_type("AdGroupAdOperation")

    ad_group_ad = operation.create
    ad_group_ad.status = getattr(client.sdk_client.enums.AdGroupAdStatusEnum, status)
    ad_group_ad.ad_group = ad_group_service.ad_group_path(
        resolved_customer_id, ad_group_id
    )

    ad = ad_group_ad.ad
    ad.name = name
    ad.final_urls.extend(final_urls)
    _set_responsive_search_ad(ad, headlines=headlines, descriptions=descriptions)

    response = ad_group_ad_service.mutate_ad_group_ads(
        customer_id=resolved_customer_id,
        operations=[operation],
    )

    return {
        "customer_id": resolved_customer_id,
        "resource_name": response.results[0].resource_name,
    }


async def update_ad(
    ad_group_id: str,
    ad_id: str,
    status: Optional[str] = None,
    name: Optional[str] = None,
    final_urls: Optional[List[str]] = None,
    headlines: Optional[List[str]] = None,
    descriptions: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Update ad status and selected creative fields."""
    if not any(
        [
            status,
            name,
            final_urls is not None,
            headlines is not None,
            descriptions is not None,
        ]
    ):
        raise ToolError("No updates provided. Set at least one field to modify.")

    auth = get_auth_from_headers()
    client = await GoogleAdsClient.build(auth)
    resolved_customer_id = client.require_customer_id()

    ad_group_ad_service = client.sdk_client.get_service("AdGroupAdService")
    operation = client.sdk_client.get_type("AdGroupAdOperation")

    ad_group_ad = operation.update
    ad_group_ad.resource_name = ad_group_ad_service.ad_group_ad_path(
        resolved_customer_id,
        ad_group_id,
        ad_id,
    )

    update_paths = []
    if status:
        ad_group_ad.status = getattr(
            client.sdk_client.enums.AdGroupAdStatusEnum, status
        )
        update_paths.append("status")

    if name:
        ad_group_ad.ad.name = name
        update_paths.append("ad.name")

    if final_urls is not None:
        ad_group_ad.ad.final_urls.clear()
        ad_group_ad.ad.final_urls.extend(final_urls)
        update_paths.append("ad.final_urls")

    if headlines is not None:
        ad_group_ad.ad.responsive_search_ad.headlines.clear()
        for value in headlines:
            if value.strip():
                asset = ad_group_ad.ad.responsive_search_ad.headlines.add()
                asset.text = value.strip()
        update_paths.append("ad.responsive_search_ad.headlines")

    if descriptions is not None:
        ad_group_ad.ad.responsive_search_ad.descriptions.clear()
        for value in descriptions:
            if value.strip():
                asset = ad_group_ad.ad.responsive_search_ad.descriptions.add()
                asset.text = value.strip()
        update_paths.append("ad.responsive_search_ad.descriptions")

    operation.update_mask.paths.extend(update_paths)

    response = ad_group_ad_service.mutate_ad_group_ads(
        customer_id=resolved_customer_id,
        operations=[operation],
    )

    return {
        "customer_id": resolved_customer_id,
        "resource_name": response.results[0].resource_name,
        "updated_fields": update_paths,
    }
