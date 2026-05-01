import json
import os
from typing import Any, Dict, List, Optional

from apify_client import ApifyClient

MAX_FB_ADS_RESULTS = 10


def _standardize_ad(item: Dict[str, Any]) -> Dict[str, Any]:
    media = item.get("media") or {}
    ad_details = item.get("ad_details") or {}
    advertiser = ad_details.get("advertiser") or {}
    page_info = (
        advertiser.get("ad_library_page_info", {}).get("page_info") or {}
    )
    aaa = ad_details.get("aaa_info") or {}

    return {
        "id": item.get("id"),
        "page_id": item.get("page_id"),
        "page_name": item.get("page_name"),
        "page_url": item.get("page_url"),
        "page_likes": item.get("page_likes"),
        "page_category": item.get("page_category"),
        "page_verified": page_info.get("page_verification"),
        "ig_username": page_info.get("ig_username"),
        "ig_followers": page_info.get("ig_followers"),
        "text": item.get("text"),
        "title": item.get("title"),
        "caption": item.get("caption"),
        "cta_text": item.get("cta_text"),
        "link_url": item.get("link_url"),
        "media_type": media.get("type"),
        "media_thumbnail": media.get("primary_thumbnail"),
        "media_images": media.get("images") or [],
        "media_videos": media.get("videos") or [],
        "start_date": item.get("start_date"),
        "end_date": item.get("end_date"),
        "is_active": item.get("is_active"),
        "platforms": item.get("platforms") or [],
        "countries": item.get("countries") or [],
        "ad_category": item.get("ad_category"),
        "contains_sensitive_content": item.get("contains_sensitive_content"),
        "targeting": {
            "gender_audience": aaa.get("gender_audience"),
            "age_min": (aaa.get("age_audience") or {}).get("min"),
            "age_max": (aaa.get("age_audience") or {}).get("max"),
            "eu_total_reach": aaa.get("eu_total_reach"),
            "locations": aaa.get("location_audience") or [],
        } if aaa else None,
        "scraped_at": item.get("scraped_at"),
    }


def facebook_ads_scraper(
    search_queries: Optional[List[str]] = None,
    search_advertisers: Optional[List[str]] = None,
    url_ads: Optional[List[Dict[str, str]]] = None,
    max_results_per_query: int = MAX_FB_ADS_RESULTS,
    sort_by: str = "SORT_BY_TOTAL_IMPRESSIONS",
    active_status: str = "ALL",
    ad_type: str = "ALL",
    media_type: str = "ALL",
    countries: Optional[List[str]] = None,
    content_languages: Optional[List[str]] = None,
    publisher_platforms: Optional[List[str]] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    enrich_with_ad_details: bool = False,
) -> str:
    """
    Scrape Facebook Ads Library via Apify (actor: 20nRTxLD3a3jIlZbZ).

    Supports three search modes (combinable):
      - Keyword search via search_queries
      - Advertiser search via search_advertisers (name or page ID)
      - Direct Ad Library URL via url_ads

    Execution order per actor: URLAds → searchAdvertisers → searchQueries.
    Results are hard-capped at 10 per query regardless of what is requested.

    Args:
        search_queries: Keywords to search in Facebook Ad Library (e.g. ["nike", "apify"]).
        search_advertisers: Advertiser names or page IDs (e.g. ["Nike", "15087023444"]).
        url_ads: List of {"url": <facebook_ad_library_url>} dicts. Filters are extracted
                 from the URL automatically. Also supports single-ad URLs with ?id=.
        max_results_per_query: Max ads per query/advertiser/URL. Hard-capped at 10.
        sort_by: Sort order — "SORT_BY_TOTAL_IMPRESSIONS" (default) or other valid values.
        active_status: "ALL", "ACTIVE", or "INACTIVE".
        ad_type: "ALL", "POLITICAL_AND_ISSUE_ADS", etc.
        media_type: "ALL", "IMAGE", "VIDEO", "MEME", "NONE".
        countries: List of country codes, e.g. ["US", "GB"]. None means all countries.
        content_languages: List of language codes, e.g. ["en"]. None means all.
        publisher_platforms: List of platforms, e.g. ["facebook", "instagram"]. None means all.
        start_date: Filter ads starting from this date (YYYY-MM-DD). None means no filter.
        end_date: Filter ads up to this date (YYYY-MM-DD). None means no filter.
        enrich_with_ad_details: Fetch additional details per ad (slower, uses more credits).

    Returns:
        JSON string — list of standardized ad objects with keys:
        id, page_id, page_name, page_url, page_likes, page_category, page_verified,
        ig_username, ig_followers, text, title, caption, cta_text, link_url,
        media_type, media_thumbnail, media_images, media_videos,
        start_date, end_date, is_active, platforms, countries, ad_category,
        contains_sensitive_content, targeting (gender_audience, age_min, age_max,
        eu_total_reach, locations — only present when enrich_with_ad_details=True),
        scraped_at.
    """
    token = os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN not set")

    capped = min(max_results_per_query, MAX_FB_ADS_RESULTS)

    run_input: Dict[str, Any] = {
        "URLAds": url_ads or [],
        "searchQueries": search_queries or [],
        "searchAdvertisers": search_advertisers or [],
        "maxResultsPerQuery": capped,
        "enrichWithAdDetails": enrich_with_ad_details,
        "sortBy": sort_by,
        "countries": countries,
        "contentLanguages": content_languages,
        "publisherPlatforms": publisher_platforms,
        "activeStatus": active_status,
        "adType": ad_type,
        "mediaType": media_type,
        "startDate": start_date,
        "endDate": end_date,
    }

    client = ApifyClient(token)
    run = client.actor("20nRTxLD3a3jIlZbZ").call(run_input=run_input)

    results: List[Dict[str, Any]] = []
    dataset_id = (run or {}).get("defaultDatasetId")
    if dataset_id:
        for item in client.dataset(dataset_id).iterate_items():
            if isinstance(item, dict):
                results.append(_standardize_ad(item))
            if len(results) >= MAX_FB_ADS_RESULTS:
                break

    return json.dumps(results[:MAX_FB_ADS_RESULTS], ensure_ascii=False)


# Auto-discovery hints
TARGET_AGENTS = ["marketer_agent"]
AGENT_TOOLS = {
    "marketer_agent": [facebook_ads_scraper],
}
