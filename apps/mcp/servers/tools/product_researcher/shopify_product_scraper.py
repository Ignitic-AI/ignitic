"""
Shopify Product Scraper: scrape product data from any Shopify store via Apify.
Returns titles, descriptions, prices, variants, images, SKUs, inventory, etc.
Useful for product research, competitor analysis, price monitoring, and SEO (on-page/product audits).
"""
import json
import os
from typing import Any, Dict, List, Optional

from apify_client import ApifyClient

SHOPIFY_PRODUCT_SCRAPER_ACTOR_ID = "8F0tXsLwmoFmqF09R"


def _run_shopify_product_scraper(
    start_url: str,
    *,
    url_type: str = "auto",
    max_products: int = 0,
    apify_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Call the Shopify Product Scraper actor on Apify and return product items.

    Args:
        start_url: Full base URL of the Shopify store (e.g. https://store.myshopify.com or custom domain).
        url_type: URL type handling (default "auto").
        max_products: Max products to scrape; 0 = all.
        apify_token: Optional override for APIFY_TOKEN env var.

    Returns:
        List of product dicts (productId, title, handle, productUrl, vendor, productType,
        descriptionHtml, options, variants, images, tags, status, etc.).
    """
    token = apify_token or os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN not set")

    start_url = (start_url or "").strip()
    if not start_url:
        return []

    client = ApifyClient(token)
    run_input = {
        "startUrl": start_url,
        "urlType": url_type,
        "maxProducts": int(max_products),
    }

    run = client.actor(SHOPIFY_PRODUCT_SCRAPER_ACTOR_ID).call(run_input=run_input)
    results: List[Dict[str, Any]] = []
    dataset_id = run.get("defaultDatasetId")
    if dataset_id:
        for item in client.dataset(dataset_id).iterate_items():
            if isinstance(item, dict):
                results.append(item)
    return results


def shopify_product_scraper(
    start_url: str,
    url_type: str = "auto",
    max_products: int = 0,
) -> str:
    """
    Scrape product data from a Shopify store (titles, descriptions, prices, variants, images, SKUs, inventory).

    Use for e-commerce analysis, price monitoring, product feeds, competitor product/SEO analysis.

    Args:
        start_url: Full Shopify store URL (e.g. https://store.myshopify.com or https://www.yourcustomdomain.com).
        url_type: URL type handling (default "auto").
        max_products: Max products to scrape; 0 = all products.

    Returns:
        JSON string: list of product objects with productId, title, handle, productUrl, vendor,
        productType, descriptionHtml, options, variants (price, sku, available, inventoryQuantity),
        images (src, alt), tags, status, createdAt, updatedAt, publishedAt, etc.
    """
    items = _run_shopify_product_scraper(
        start_url=start_url,
        url_type=url_type,
        max_products=max_products,
    )
    return json.dumps(items, ensure_ascii=False)


# Auto-discovery hints for agent tool routing
TARGET_AGENTS = ["product_researcher_agent", "seo_agent"]
AGENT_TOOLS = {
    "product_researcher_agent": [shopify_product_scraper],
    "seo_agent": [shopify_product_scraper],
}
