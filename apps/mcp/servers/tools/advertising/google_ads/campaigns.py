"""Google Ads campaign create/update tools."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastmcp.exceptions import ToolError

from .client import GoogleAdsClient, get_auth_from_headers


async def create_campaign(
    name: str,
    daily_budget: int,
    status: str = "PAUSED",
    advertising_channel_type: str = "SEARCH",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a Google Ads campaign with a dedicated campaign budget."""
    if daily_budget <= 0:
        raise ToolError(
            "daily_budget must be a positive integer in account currency units."
        )

    auth = get_auth_from_headers()
    client = await GoogleAdsClient.build(auth)
    resolved_customer_id = client.require_customer_id()

    budget_service = client.sdk_client.get_service("CampaignBudgetService")
    budget_operation = client.sdk_client.get_type("CampaignBudgetOperation")

    budget = budget_operation.create
    budget.name = f"{name} - Budget"
    budget.delivery_method = client.sdk_client.enums.BudgetDeliveryMethodEnum.STANDARD
    budget.amount_micros = int(daily_budget) * 1_000_000

    budget_response = budget_service.mutate_campaign_budgets(
        customer_id=resolved_customer_id,
        operations=[budget_operation],
    )
    budget_resource_name = budget_response.results[0].resource_name

    campaign_service = client.sdk_client.get_service("CampaignService")
    campaign_operation = client.sdk_client.get_type("CampaignOperation")
    campaign = campaign_operation.create

    campaign.name = name
    campaign.status = getattr(client.sdk_client.enums.CampaignStatusEnum, status)
    campaign.advertising_channel_type = getattr(
        client.sdk_client.enums.AdvertisingChannelTypeEnum,
        advertising_channel_type,
    )
    campaign.campaign_budget = budget_resource_name

    if start_date:
        campaign.start_date = start_date
    if end_date:
        campaign.end_date = end_date

    response = campaign_service.mutate_campaigns(
        customer_id=resolved_customer_id,
        operations=[campaign_operation],
    )

    return {
        "customer_id": resolved_customer_id,
        "resource_name": response.results[0].resource_name,
        "campaign_budget_resource_name": budget_resource_name,
    }


async def update_campaign(
    campaign_id: str,
    name: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Update mutable campaign fields."""
    if not any([name, status, start_date, end_date]):
        raise ToolError("No updates provided. Set at least one field to modify.")

    auth = get_auth_from_headers()
    client = await GoogleAdsClient.build(auth)
    resolved_customer_id = client.require_customer_id()

    campaign_service = client.sdk_client.get_service("CampaignService")
    campaign_operation = client.sdk_client.get_type("CampaignOperation")
    campaign = campaign_operation.update
    campaign.resource_name = campaign_service.campaign_path(
        resolved_customer_id, campaign_id
    )

    update_paths = []
    if name:
        campaign.name = name
        update_paths.append("name")
    if status:
        campaign.status = getattr(client.sdk_client.enums.CampaignStatusEnum, status)
        update_paths.append("status")
    if start_date:
        campaign.start_date = start_date
        update_paths.append("start_date")
    if end_date:
        campaign.end_date = end_date
        update_paths.append("end_date")

    campaign_operation.update_mask.paths.extend(update_paths)

    response = campaign_service.mutate_campaigns(
        customer_id=resolved_customer_id,
        operations=[campaign_operation],
    )

    return {
        "customer_id": resolved_customer_id,
        "resource_name": response.results[0].resource_name,
        "updated_fields": update_paths,
    }
