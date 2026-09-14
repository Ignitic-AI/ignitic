import os
import json
from typing import List, Dict, Any, Optional
from apify_client import ApifyClient
from langchain_core.tools import tool


def _standardize_item(item: Dict[str, Any], domain_code: str) -> Dict[str, Any]:
    url_path = item.get("dpUrl") or item.get("url") or ""
    url = f"https://www.amazon.{domain_code}{url_path}" if url_path.startswith("/") else url_path

    return {
        "asin": item.get("asin"),
        "title": item.get("productDescription") or item.get("title"),
        "price": item.get("price"),
        "retailPrice": item.get("retailPrice"),
        "imageUrl": item.get("imgUrl") or item.get("image"),
        "rating": item.get("productRating") or item.get("rating"),
        "reviewsCount": item.get("countReview") or item.get("reviewsCount"),
        "prime": item.get("prime"),
        "url": url,
        "manufacturer": item.get("manufacturer"),
        "sponsored": item.get("sponsored"),
        "position": item.get("searchResultPosition"),
        "deliveryMessage": item.get("deliveryMessage"),
        "salesVolume": item.get("salesVolume"),
        "categories": item.get("categories"),
        "similarKeywords": [
            k.get("keyword") for k in (item.get("similarKeywords") or []) if isinstance(k, dict)
        ],
    }


def _search_amazon_products(
    keyword: str,
    *,
    domain_code: str = "com",
    max_results: int = 50,
    sort_by: str = "relevanceblender",
    category: str = "aps",
    max_pages: Optional[int] = None,
    apify_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Search Amazon via Apify and return standardized results.

    Args:
        keyword: Search keyword, e.g. "Men Shoes".
        domain_code: Amazon TLD like "com", "co.uk", "de".
        max_results: Max number of results to return (slice client-side).
        sort_by: Apify sort strategy, e.g. "relevanceblender", "recent".
        category: Amazon category (default "aps").
        max_pages: Optional override (currently only first page is fetched).
        apify_token: APIFY API token (uses env APIFY_TOKEN if not provided).

    Returns:
        List of standardized product dictionaries.
    """
    token = apify_token or os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN not set")

    client = ApifyClient(token)

    pages_to_fetch = 1 if max_pages is None else max(1, int(max_pages))

    run_input = {
        "input": [
            {
                "keyword": keyword,
                "domainCode": domain_code,
                "sortBy": sort_by,
                "maxPages": pages_to_fetch,
                "category": category,
            }
        ]
    }

    run = client.actor("9GmEDf8sr9Jyb6b3X").call(run_input=run_input)

    standardized: List[Dict[str, Any]] = []
    for raw in client.dataset(run["defaultDatasetId"] if run else '').iterate_items():
        if isinstance(raw, dict) and "asin" in raw:
            standardized.append(_standardize_item(raw, domain_code))
        elif isinstance(raw, list):
            for sub in raw:
                if isinstance(sub, dict):
                    standardized.append(_standardize_item(sub, domain_code))
        if len(standardized) >= max_results:
            break

    return standardized[:max_results]


@tool("apify_amazon_search", return_direct=False)
def apify_amazon_search(
    keyword: str,
    domain_code: str = "com",
    max_results: int = 30,
    sort_by: str = "relevanceblender",
    category: str = "aps",
    max_pages: Optional[int] = None,
) -> str:
    """
    Search Amazon marketplace via Apify (Amazon-only). Returns JSON list of standardized products
    with keys: asin, title, price, retailPrice, imageUrl, rating, reviewsCount, prime,
    url, manufacturer, sponsored, position, deliveryMessage, salesVolume, categories,
    similarKeywords.

    Args:
        keyword: Search query specific to Amazon marketplace (e.g., "rc cars", "hunting gear").
        domain_code: Amazon TLD (com, co.uk, de, fr, etc.).
        max_results: Max products to return (default 30).
        sort_by: Amazon sort (e.g., relevanceblender, recent).
        category: Amazon category (default "aps").
        max_pages: Optional number of pages to fetch (defaults to 1 for speed/cost).
    """
    items = _search_amazon_products(
        keyword=keyword,
        domain_code=domain_code,
        max_results=max_results,
        sort_by=sort_by,
        category=category,
        max_pages=max_pages,
    )
    return json.dumps(items, ensure_ascii=False)


# Auto-discovery hints for the loader
TARGET_AGENTS = ["product_researcher_agent"]
AGENT_TOOLS = {
    "product_researcher_agent": [apify_amazon_search],
}


