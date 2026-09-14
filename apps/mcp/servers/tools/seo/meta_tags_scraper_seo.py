"""
Meta Tags Scraper for SEO: fetches meta tags from one or more URLs via Apify.
Useful for on-page SEO audits (title, description, robots, OG, Twitter, viewport).
"""
import json
import os
from typing import Any, Dict, List, Optional, Union

from apify_client import ApifyClient

META_TAGS_ACTOR_ID = "Xoyb1E3oJQI8OsoYg"


def _run_meta_tags_actor(
    urls: List[str],
    *,
    apify_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Call the Meta Tags Scraper actor on Apify and return results.

    Args:
        urls: List of full URLs to scrape (e.g. ["https://example.com/page"]).
        apify_token: Optional override for the APIFY_TOKEN env var.

    Returns:
        List of items with keys: url, meta_name, content.
    """
    token = apify_token or os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN not set")

    client = ApifyClient(token)
    run_input = {
        "urls": [{"url": u.strip()} for u in urls if u and isinstance(u, str)],
    }
    if not run_input["urls"]:
        return []

    run = client.actor(META_TAGS_ACTOR_ID).call(run_input=run_input)
    results: List[Dict[str, Any]] = []
    dataset_id = run.get("defaultDatasetId")
    if dataset_id:
        for item in client.dataset(dataset_id).iterate_items():
            if isinstance(item, dict) and "url" in item and "meta_name" in item:
                results.append(
                    {
                        "url": item.get("url"),
                        "meta_name": item.get("meta_name"),
                        "content": item.get("content"),
                    }
                )
    return results


def meta_tags_scraper_seo(
    urls: Union[str, List[str]],
) -> str:
    """
    Scrape meta tags from one or more URLs for SEO audit (title, description, robots, OG, Twitter, viewport).

    Args:
        urls: A single URL string or a list of URL strings to scrape.

    Returns:
        JSON string: list of objects with url, meta_name, and content for each meta tag found.
    """
    if isinstance(urls, str):
        url_list = [urls]
    else:
        url_list = list(urls) if urls else []
    items = _run_meta_tags_actor(urls=url_list)
    return json.dumps(items, ensure_ascii=False)


TARGET_AGENTS = ["seo_agent", "marketer_agent"]
AGENT_TOOLS = {
    "seo_agent": [meta_tags_scraper_seo],
    "marketer_agent": [meta_tags_scraper_seo],
}
