"""Google Ads creative asset create/update tools."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastmcp.exceptions import ToolError

from .client import GoogleAdsClient, get_auth_from_headers


async def create_creative_asset(
    name: str,
    text: str,
) -> Dict[str, Any]:
    """Create a text asset to use in ads."""
    if not text.strip():
        raise ToolError("text is required to create a creative asset")

    auth = get_auth_from_headers()
    client = await GoogleAdsClient.build(auth)
    resolved_customer_id = client.require_customer_id()

    asset_service = client.sdk_client.get_service("AssetService")
    operation = client.sdk_client.get_type("AssetOperation")

    asset = operation.create
    asset.name = name
    asset.text_asset.text = text

    response = asset_service.mutate_assets(
        customer_id=resolved_customer_id,
        operations=[operation],
    )

    return {
        "customer_id": resolved_customer_id,
        "resource_name": response.results[0].resource_name,
    }


async def update_creative_asset(
    asset_id: str,
    name: Optional[str] = None,
    text: Optional[str] = None,
) -> Dict[str, Any]:
    """Update mutable text-asset fields."""
    if not any([name, text]):
        raise ToolError("No updates provided. Set at least one field to modify.")

    auth = get_auth_from_headers()
    client = await GoogleAdsClient.build(auth)
    resolved_customer_id = client.require_customer_id()

    asset_service = client.sdk_client.get_service("AssetService")
    operation = client.sdk_client.get_type("AssetOperation")

    asset = operation.update
    asset.resource_name = asset_service.asset_path(resolved_customer_id, asset_id)

    update_paths = []
    if name:
        asset.name = name
        update_paths.append("name")
    if text:
        asset.text_asset.text = text
        update_paths.append("text_asset.text")

    operation.update_mask.paths.extend(update_paths)

    response = asset_service.mutate_assets(
        customer_id=resolved_customer_id,
        operations=[operation],
    )

    return {
        "customer_id": resolved_customer_id,
        "resource_name": response.results[0].resource_name,
        "updated_fields": update_paths,
    }
