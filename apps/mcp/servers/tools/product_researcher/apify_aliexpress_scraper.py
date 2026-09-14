"""AliExpress product search via Apify actor mfblss3fLQRaqhg6K."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

from apify_client import ApifyClient

_ALIEXPRESS_ACTOR_ID = "mfblss3fLQRaqhg6K"
# Hard caps (not user-overridable): cost and scope control.
_MAX_PAGES = 1
_MAX_ITEMS = 10


def _as_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _as_int(v: Any) -> Optional[int]:
    if v is None:
        return None
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def _standardize_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Flatten nested actor output to a stable snake_case schema."""
    title_obj = item.get("title")
    display_title: Optional[str] = None
    if isinstance(title_obj, dict):
        display_title = title_obj.get("displayTitle") or title_obj.get("seoTitle")
    elif isinstance(title_obj, str):
        display_title = title_obj

    image = item.get("image") or {}
    img_url = image.get("imgUrl") if isinstance(image, dict) else None

    prices = item.get("prices") or {}
    currency = prices.get("currencyCode") if isinstance(prices, dict) else None
    sale_block = prices.get("salePrice") if isinstance(prices, dict) else {}
    orig_block = prices.get("originalPrice") if isinstance(prices, dict) else {}

    ext = item.get("extractedData") or {}
    store = item.get("store") or {}
    shipping = item.get("shipping") if isinstance(item.get("shipping"), dict) else {}
    evaluation = item.get("evaluation") if isinstance(item.get("evaluation"), dict) else {}

    rating = ext.get("rating")
    if rating is None:
        rating = evaluation.get("starRating")

    options = shipping.get("options") if isinstance(shipping, dict) else None
    shipping_summary: Optional[List[Dict[str, Any]]] = None
    if isinstance(options, list):
        shipping_summary = []
        for o in options[:8]:
            if isinstance(o, dict):
                shipping_summary.append(
                    {
                        "provider": o.get("provider"),
                        "cost": o.get("cost"),
                        "is_free": o.get("isFree"),
                        "delivery_days": o.get("deliveryDays"),
                    }
                )

    return {
        "product_id": item.get("productId"),
        "query": item.get("query"),
        "title": display_title,
        "current_price": _as_float(ext.get("currentPrice")),
        "original_price": _as_float(ext.get("originalPrice")),
        "discount_percent": _as_int(ext.get("discountPercent")),
        "total_orders": _as_int(ext.get("totalOrders")),
        "rating": _as_float(rating),
        "currency_code": currency or "USD",
        "sale_price_formatted": sale_block.get("formattedPrice") if isinstance(sale_block, dict) else None,
        "original_price_formatted": orig_block.get("formattedPrice") if isinstance(orig_block, dict) else None,
        "store_name": store.get("storeName") if isinstance(store, dict) else None,
        "store_url": store.get("storeUrl") if isinstance(store, dict) else None,
        "product_detail_url": item.get("productDetailUrl"),
        "main_image_url": img_url,
        "shipping_is_free": shipping.get("isFree") if isinstance(shipping, dict) else None,
        "shipping_options": shipping_summary,
        "scraped_at": item.get("scrapedAt"),
    }


def _parse_queries(queries: str) -> List[str]:
    return [p.strip() for p in queries.replace("\n", ",").split(",") if p.strip()]


def _parse_start_urls(start_urls: Optional[str]) -> List[str]:
    if not start_urls or not str(start_urls).strip():
        return []
    return [p.strip() for p in str(start_urls).replace("\n", ",").split(",") if p.strip()]


def _run_aliexpress_scraper(
    query_list: List[str],
    url_list: List[str],
    *,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
    min_order_count: Optional[int] = None,
    sort_by: str = "default",
    ship_to: str = "US",
    currency: str = "USD",
    language: str = "en_US",
    ships_from: str = "Any",
    apify_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    token = apify_token or os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN not set")

    run_input: Dict[str, Any] = {
        "queries": query_list,
        "startUrls": url_list,
        "maxPages": _MAX_PAGES,
        "maxItems": _MAX_ITEMS,
        "language": language,
        "shipTo": ship_to,
        "currency": currency,
        "shipsFrom": ships_from,
        "sortBy": sort_by,
        "includeDescription": False,
        "includeVariants": False,
        "includeShippingDetails": True,
        "includeReviews": False,
        "maxReviews": 10,
        "includeQuestions": False,
        "maxQuestions": 10,
        "deduplicateProducts": True,
        "maxConcurrency": 5,
        "maxRequestRetries": 5,
        "proxyCountry": "US",
    }
    if min_price is not None:
        run_input["minPrice"] = float(min_price)
    if max_price is not None:
        run_input["maxPrice"] = float(max_price)
    if min_rating is not None:
        run_input["minRating"] = float(min_rating)
    if min_order_count is not None:
        run_input["minOrderCount"] = int(min_order_count)

    client = ApifyClient(token)
    run = client.actor(_ALIEXPRESS_ACTOR_ID).call(run_input=run_input)

    if not run or not run.get("defaultDatasetId"):
        return []

    out: List[Dict[str, Any]] = []
    for raw in client.dataset(run["defaultDatasetId"]).iterate_items():
        if isinstance(raw, dict):
            out.append(_standardize_item(raw))
        if len(out) >= _MAX_ITEMS:
            break
    return out[:_MAX_ITEMS]


def apify_aliexpress_search(
    queries: str = "",
    start_urls: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
    min_order_count: Optional[int] = None,
    sort_by: str = "default",
    ship_to: str = "US",
    currency: str = "USD",
    language: str = "en_US",
    ships_from: str = "Any",
) -> str:
    """
    Search AliExpress for products via Apify. Returns a JSON list (max 10 items) of standardized rows:
    product_id, query, title, current_price, original_price, discount_percent, total_orders, rating, currency_code,
    sale_price_formatted, original_price_formatted, store_name, store_url, product_detail_url, main_image_url,
    shipping_is_free, shipping_options, scraped_at.

    max_pages is always 1 and max items is always 10 (hard caps).

    Args:
        queries: Comma-separated keyword searches (can be empty if start_urls is set).
        start_urls: Optional comma-separated AliExpress product, category, or search URLs.
        min_price / max_price: Price band in selected currency.
        min_rating: Minimum star rating (0–5).
        min_order_count: Minimum sales volume filter when supported by actor.
        sort_by: default | orders | price_asc | price_desc | rating | newest
        ship_to: Destination country code (default US).
        currency: ISO currency for prices (default USD).
        language: Locale for listing text (default en_US).
        ships_from: Warehouse filter (default Any).
    """
    qlist = _parse_queries(queries) if queries else []
    urls = _parse_start_urls(start_urls)
    if not qlist and not urls:
        raise ValueError("Provide at least one keyword in queries or at least one URL in start_urls")

    items = _run_aliexpress_scraper(
        qlist,
        urls,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
        min_order_count=min_order_count,
        sort_by=sort_by,
        ship_to=ship_to,
        currency=currency,
        language=language,
        ships_from=ships_from,
    )
    return json.dumps(items, ensure_ascii=False)


TARGET_AGENTS = ["product_researcher_agent"]
AGENT_TOOLS = {
    "product_researcher_agent": [apify_aliexpress_search],
}
