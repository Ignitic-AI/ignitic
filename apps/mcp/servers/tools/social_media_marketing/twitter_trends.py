import json
import os
from typing import Any, Dict, List, Optional

from apify_client import ApifyClient


def _run_twitter_trends_actor(
    country: str,
    max_results: int,
    *,
    apify_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Call the Twitter Trends Scraper actor on Apify and return parsed results.

    Args:
        country: Country name from the actor's supported list (e.g., UnitedStates, India).
        max_results: Desired maximum results; will be capped to 10 for cost/safety.
        apify_token: Optional override for the APIFY_TOKEN env var.

    Returns:
        List of trend dictionaries with name, description, context, scrapedAt.
    """
    token = apify_token or os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN not set")

    # Cap to 10 for cost control as requested
    safe_max = max(1, min(int(max_results), 10))

    client = ApifyClient(token)
    run_input = {
        "country": country,
        "maxResults": safe_max,
    }

    run = client.actor("dN7chLDMrEwdIVpKa").call(run_input=run_input)

    results: List[Dict[str, Any]] = []
    dataset_id = run.get("defaultDatasetId")
    if dataset_id:
        for item in client.dataset(dataset_id).iterate_items():
            if not isinstance(item, dict):
                continue
            results.append(
                {
                    "name": item.get("name"),
                    "description": item.get("description"),
                    "context": item.get("context"),
                    "scrapedAt": item.get("scrapedAt"),
                }
            )
            if len(results) >= safe_max:
                break

    return results


def twitter_trends(country: str = "UnitedStates", max_results: int = 5) -> str:
    """
    Fetch Twitter trending topics for a given country using the Apify actor.

    Args:
        country: Country name (must match the actor's supported list). Default: UnitedStates.
        max_results: Max number of trends to return (capped at 10).

    Returns:
        JSON string list of trends with keys: name, description, context, scrapedAt.
    """
    trends = _run_twitter_trends_actor(country=country, max_results=max_results)
    return json.dumps(trends, ensure_ascii=False)


# Auto-discovery hints
TARGET_AGENTS = ["marketer_agent"]
AGENT_TOOLS = {
    "marketer_agent": [twitter_trends],
}

