import json
import os
from typing import Any, Dict, List, Optional

from apify_client import ApifyClient


def _run_facebook_ads_actor(
    targets: List[Dict[str, str]],
    *,
    ads_limit: int = 200,
    scroll_count: int = 2,
    headless: bool = True,
    max_concurrency: int = 1,
    delay: int = 2000,
    apify_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Call the Facebook Ads Library scraper actor on Apify and return parsed results.

    Args:
        targets: List of {"country": str, "keyword": str}.
        ads_limit: Max ads per target (capped to 500 for safety/cost).
        scroll_count: Number of scroll actions to load more ads.
        headless: Run browser headless.
        max_concurrency: Max concurrent browser instances.
        delay: Delay between actions in ms.
        apify_token: Optional override for APIFY_TOKEN env var.

    Returns:
        List of results per target with ads and metadata.
    """
    token = apify_token or os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN not set")

    # Safety cap
    safe_ads_limit = max(1, min(int(ads_limit), 500))

    client = ApifyClient(token)
    run_input = {
        "targets": targets,
        "adsLimit": safe_ads_limit,
        "scrollCount": int(scroll_count),
        "headless": bool(headless),
        "maxConcurrency": int(max_concurrency),
        "delay": int(delay),
    }

    run = client.actor("dPt67OHKbDIyGHL36").call(run_input=run_input)

    results: List[Dict[str, Any]] = []
    dataset_id = run.get("defaultDatasetId")
    if dataset_id:
        for item in client.dataset(dataset_id).iterate_items():
            if isinstance(item, dict):
                results.append(item)
    return results


def facebook_ads_scraper(
    targets: List[Dict[str, str]],
    ads_limit: int = 200,
    scroll_count: int = 2,
    headless: bool = True,
    max_concurrency: int = 1,
    delay: int = 2000,
) -> str:
    """
    Scrape Facebook Ads Library for given country/keyword targets via Apify.

    Args:
        targets: List of {"country": str, "keyword": str}.
        ads_limit: Max ads per target (capped at 500).
        scroll_count: Scroll actions to load more ads.
        headless: Run browser headless.
        max_concurrency: Max concurrent browser instances.
        delay: Delay between actions in ms.

    Returns:
        JSON string of results; each item corresponds to a target with ads and metadata.
    """
    items = _run_facebook_ads_actor(
        targets=targets,
        ads_limit=ads_limit,
        scroll_count=scroll_count,
        headless=headless,
        max_concurrency=max_concurrency,
        delay=delay,
    )
    return json.dumps(items, ensure_ascii=False)


# Auto-discovery hints
TARGET_AGENTS = ["marketer_agent"]
AGENT_TOOLS = {
    "marketer_agent": [facebook_ads_scraper],
}

