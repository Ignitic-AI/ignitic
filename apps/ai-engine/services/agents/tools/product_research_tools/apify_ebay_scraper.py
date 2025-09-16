import json
import os
from typing import List, Dict, Optional
from datetime import datetime

from apify_client import ApifyClient
from langchain_core.tools import tool


def _safe_import_dotenv():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass


def _standardize_ebay_item(raw_item: Dict) -> Dict:
    """
    Standardize a raw eBay item response into a consistent format
    
    Args:
        raw_item: Raw item data from Apify
        
    Returns:
        Standardized item dictionary
    """
    try:
        # Extract and standardize basic information
        standardized = {
            "id": str(raw_item.get("itemNumber", "")),
            "title": raw_item.get("title", ""),
            "url": raw_item.get("url", ""),
            "condition": raw_item.get("condition", "Unknown"),
            "brand": raw_item.get("itemSpecificAttributes", {}).get("Brand", "Unknown"),
            
            # Pricing information
            "price": {
                "current": {
                    "value": raw_item.get("price", {}).get("current", {}).get("value", 0.0),
                    "currency": raw_item.get("price", {}).get("current", {}).get("currency", "USD")
                },
                "shipping": {
                    "value": raw_item.get("shippingPrice", {}).get("value", 0.0),
                    "currency": raw_item.get("shippingPrice", {}).get("currency", "USD")
                }
            },
            
            # Inventory information
            "inventory": {
                "available": raw_item.get("availableAmount", 0),
                "sold": raw_item.get("soldAmount", 0),
                "total_sold": raw_item.get("soldAmount", 0) + raw_item.get("availableAmount", 0)
            },
            
            # Images
            "images": {
                "main": raw_item.get("previewImageUrl", ""),
                "all": raw_item.get("imageUrls", [])
            },
            
            # Categories
            "categories": raw_item.get("categories", []),
            "category_paths": raw_item.get("categoryPaths", []),
            
            # Additional attributes
            "attributes": _extract_ebay_attributes(raw_item.get("itemSpecificAttributes", {})),
            
            # Promotional information
            "promotion": {
                "is_promoted": raw_item.get("isPromoted", False),
                "why_to_buy": raw_item.get("whyToBuy", [])
            },
            
            # Metadata
            "metadata": {
                "scraped_at": datetime.now().isoformat(),
                "source": "ebay",
                "raw_data_keys": list(raw_item.keys())
            }
        }
        
        # Calculate total price
        current_price = standardized["price"]["current"]["value"]
        shipping_price = standardized["price"]["shipping"]["value"]
        standardized["price"]["total"] = {
            "value": current_price + shipping_price,
            "currency": standardized["price"]["current"]["currency"]
        }
        
        # Add availability status
        if standardized["inventory"]["available"] > 0:
            standardized["availability"] = "In Stock"
        else:
            standardized["availability"] = "Out of Stock"
        
        return standardized
        
    except Exception as e:
        return {
            "error": f"Failed to standardize item: {str(e)}",
            "raw_data": raw_item,
            "metadata": {
                "scraped_at": datetime.now().isoformat(),
                "source": "ebay"
            }
        }


def _extract_ebay_attributes(attributes: Dict) -> Dict:
    """Extract and clean item-specific attributes"""
    cleaned_attributes = {}
    
    for key, value in attributes.items():
        if value and value != "Does Not Apply" and value != "Does not apply":
            # Clean up the key name
            clean_key = key.replace(" ", "_").lower()
            cleaned_attributes[clean_key] = value
    
    return cleaned_attributes


def _search_ebay_products(
    query: str,
    *,
    max_results: int = 50,
    country: str = "US",
    apify_token: Optional[str] = None,
) -> List[Dict]:
    """
    Search for products on eBay using Apify
    
    Args:
        query: Search query (e.g., "arduino")
        max_results: Maximum number of results to return (default 50)
        country: Country code for simulation (e.g., "US", "UK")
        apify_token: APIFY API token (uses env APIFY_TOKEN if not provided)
        
    Returns:
        List of standardized product dictionaries
    """
    token = apify_token or os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN not set")
    
    client = ApifyClient(token)
    actor_id = "v8tQQIkViKadoELfs"  # eBay scraper actor
    
    try:
        search_url = f"https://www.ebay.com/sch/i.html?_nkw={query}&_sacat=0&_from=R40&_ipg={min(max_results, 240)}&_pgn=1"
        
        run_input = {
            "startUrls": [search_url],
            "resultLimitPerUrl": max_results,
            "simulateCountryCode": country,
        }
        
        run = client.actor(actor_id).call(run_input=run_input)
        
        if not run or "defaultDatasetId" not in run:
            return []
        
        standardized_items = []
        
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            standardized_item = _standardize_ebay_item(item)
            standardized_items.append(standardized_item)
            
            if len(standardized_items) >= max_results:
                break
        
        return standardized_items
        
    except Exception as e:
        raise RuntimeError(f"Error searching eBay products: {e}")


@tool("apify_ebay_search", return_direct=False)
def apify_ebay_search(
    query: str,
    max_results: int = 30,
    country: str = "US",
) -> str:
    """
    Search eBay marketplace via Apify. Returns JSON list of standardized products
    with keys: id, title, url, condition, brand, price (current, shipping, total),
    inventory (available, sold, total_sold), images (main, all), categories,
    category_paths, attributes, promotion, availability, metadata.

    Args:
        query: Search query for eBay marketplace (e.g., "arduino", "gaming laptop").
        max_results: Max products to return (default 30, max 240).
        country: Country code for simulation (default "US").
    """
    _safe_import_dotenv()
    
    items = _search_ebay_products(
        query=query,
        max_results=max_results,
        country=country,
    )
    return json.dumps(items, ensure_ascii=False)


TARGET_AGENTS = ["product_researcher_agent"]
AGENT_TOOLS = {
    "product_researcher_agent": [apify_ebay_search],
}
