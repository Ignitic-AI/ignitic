import json
import os
from typing import Any, Dict, List, Optional

from apify_client import ApifyClient


def _run_site_domain_authority_actor(
    domain: str,
    *,
    max_concurrency: int = 3,
    navigation_timeout: int = 60,
    page_load_delay: int = 5000,
    use_apify_proxy: bool = True,
    apify_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Call the Site Domain Authority & SEO actor on Apify and return parsed results.

    Args:
        domain: Single domain to analyze (e.g., "example.com"). Only one domain is allowed.
        max_concurrency: Actor max concurrency (default 3).
        navigation_timeout: Navigation timeout in seconds (default 60).
        page_load_delay: Page load delay in ms (default 5000).
        use_apify_proxy: Whether to use Apify proxy (default True).
        apify_token: Optional override for the APIFY_TOKEN env var.

    Returns:
        List of result dictionaries from the actor dataset.
    """
    token = apify_token or os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN not set")

    client = ApifyClient(token)
    run_input = {
        "domains": [domain],
        "maxConcurrency": int(max_concurrency),
        "navigationTimeout": int(navigation_timeout),
        "pageLoadDelay": int(page_load_delay),
        "proxyConfiguration": {"useApifyProxy": bool(use_apify_proxy)},
    }

    run = client.actor("bL147gFarcajpfr5W").call(run_input=run_input)

    def _std(item: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "domain": item.get("domain"),
            "scrapedAt": item.get("scrapedAt"),
            "domain_authority": item.get("domain_authority"),
            "monthly_visits": item.get("monthly_visits"),
            "bounce_rate": item.get("bounce_rate"),
            "pages_per_visit": item.get("pages_per_visit"),
            "avg_visit_duration_seconds": item.get("avg_visit_duration_seconds"),
            "traffic_change_percent": item.get("traffic_change_percent"),
            "organic_search_visits": item.get("organic_search_visits"),
            "paid_search_visits": item.get("paid_search_visits"),
            "direct_visits_percent": item.get("direct_visits_percent"),
            "desktop_traffic_percent": item.get("desktop_traffic_percent"),
            "mobile_traffic_percent": item.get("mobile_traffic_percent"),
            "global_rank": item.get("global_rank"),
            "country_rank": item.get("country_rank"),
            "country": item.get("country"),
            "industry_category": item.get("industry_category"),
            "total_backlinks": item.get("total_backlinks"),
            "referring_domains": item.get("referring_domains"),
            "competitors": item.get("competitors") or [],
            "organic_keywords": item.get("organic_keywords") or [],
            "top_countries": item.get("top_countries") or [],
        }

    results: List[Dict[str, Any]] = []
    dataset_id = run.get("defaultDatasetId")
    if dataset_id:
        for item in client.dataset(dataset_id).iterate_items():
            if isinstance(item, dict):
                results.append(_std(item))
    return results


def site_domain_authority_seo(
    domain: str,
    max_concurrency: int = 3,
    navigation_timeout: int = 60,
    page_load_delay: int = 5000,
    use_apify_proxy: bool = True,
) -> str:
    """
    Fetch domain authority & SEO report for a single domain via Apify.

    Args:
        domain: Single domain to analyze (required).
        max_concurrency: Actor max concurrency (default 3).
        navigation_timeout: Navigation timeout in seconds (default 60).
        page_load_delay: Page load delay in ms (default 5000).
        use_apify_proxy: Use Apify proxy (default True).

    Returns:
        JSON string of results (list; typically one item).
    """
    items = _run_site_domain_authority_actor(
        domain=domain,
        max_concurrency=max_concurrency,
        navigation_timeout=navigation_timeout,
        page_load_delay=page_load_delay,
        use_apify_proxy=use_apify_proxy,
    )
    return json.dumps(items, ensure_ascii=False)


# Auto-discovery hints
TARGET_AGENTS = ["marketer_agent", "seo_agent"]
AGENT_TOOLS = {
    "marketer_agent": [site_domain_authority_seo],
    "seo_agent": [site_domain_authority_seo],
}
