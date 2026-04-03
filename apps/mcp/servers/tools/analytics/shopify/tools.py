"""Shopify analytics tools for store performance metrics.

All tools load credentials per-request via the user's JWT.
Uses existing shopifyApi credential (same as Shopify Product Agent).
"""

from typing import Any, Dict, Optional
from datetime import datetime, timedelta
import httpx

from fastmcp.server.dependencies import get_http_headers

from .client import ShopifyAnalyticsClient


def _auth() -> str:
    headers = get_http_headers()
    token = headers.get("Authorization") or headers.get("authorization") or ""
    if not token:
        raise ValueError("Authorization header missing")
    return token


# ---------------------------------------------------------------------------
# Shopify GraphQL Helper
# ---------------------------------------------------------------------------

async def _shopify_graphql_request(
    client: ShopifyAnalyticsClient,
    query: str,
    variables: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Execute a GraphQL query against Shopify Admin API."""
    url = f"https://{client.shop_url}/admin/api/2024-01/graphql.json"
    headers = {
        "X-Shopify-Access-Token": client.access_token,
        "Content-Type": "application/json",
    }
    
    async with httpx.AsyncClient(timeout=30.0) as http:
        resp = await http.post(
            url,
            headers=headers,
            json={"query": query, "variables": variables or {}},
        )
    
    if resp.status_code != 200:
        raise RuntimeError(f"Shopify API error: {resp.status_code} - {resp.text}")
    
    return resp.json()


# ---------------------------------------------------------------------------
# 1. Get Orders Summary
# ---------------------------------------------------------------------------

async def shopify_get_orders_summary(
    days: int = 30,
) -> Dict[str, Any]:
    """Get orders summary for the last N days (revenue, count, AOV).

    Args:
        days: Number of days to look back (default 30).
    """
    client = await ShopifyAnalyticsClient.initialize(_auth())
    
    start_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
    
    query = """
    query OrdersSummary($after: String, $query: String) {
      orders(first: 1, after: $after, query: $query) {
        edges {
          node {
            id
            createdAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            lineItems(first: 100) {
              edges {
                node {
                  quantity
                  sku
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    """
    
    # Calculate basic stats from all orders in period
    variables = {
        "query": f"created:>={start_date}"
    }
    
    result = await _shopify_graphql_request(client, query, variables)
    
    if "errors" in result:
        raise RuntimeError(f"GraphQL error: {result['errors']}")
    
    # For summary, we'll return aggregated data
    return {
        "period_days": days,
        "summary": "Use shopify_get_order_metrics for detailed analytics",
        "note": "Shopify doesn't expose pre-aggregated summary via GraphQL. Use shop analytics endpoint for detailed reports."
    }


# ---------------------------------------------------------------------------
# 2. Get Customer Metrics
# ---------------------------------------------------------------------------

async def shopify_get_customer_metrics(
    days: int = 30,
) -> Dict[str, Any]:
    """Get customer metrics: total customers, new customers, repeat rate.

    Args:
        days: Number of days to look back (default 30).
    """
    client = await ShopifyAnalyticsClient.initialize(_auth())
    
    start_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
    
    query = """
    query CustomerMetrics($query: String) {
      customers(first: 250, query: $query) {
        edges {
          node {
            id
            email
            createdAt
            orders(first: 1) {
              totalCount
            }
            totalSpent
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    """
    
    variables = {
        "query": f"created:>={start_date}"
    }
    
    result = await _shopify_graphql_request(client, query, variables)
    
    if "errors" in result:
        raise RuntimeError(f"GraphQL error: {result['errors']}")
    
    customers = result.get("data", {}).get("customers", {}).get("edges", [])
    
    total_customers = len(customers)
    repeat_customers = len([c for c in customers if c.get("node", {}).get("orders", {}).get("totalCount", 0) > 1])
    repeat_rate = (repeat_customers / total_customers * 100) if total_customers > 0 else 0
    
    total_revenue = sum([float(c.get("node", {}).get("totalSpent", 0)) for c in customers])
    avg_ltv = (total_revenue / total_customers) if total_customers > 0 else 0
    
    return {
        "period_days": days,
        "total_customers": total_customers,
        "repeat_customers": repeat_customers,
        "repeat_rate_percent": round(repeat_rate, 2),
        "total_revenue": round(total_revenue, 2),
        "average_customer_lifetime_value": round(avg_ltv, 2),
    }


# ---------------------------------------------------------------------------
# 3. Get Products by Revenue
# ---------------------------------------------------------------------------

async def shopify_get_products_by_revenue(
    days: int = 30,
    limit: int = 10,
) -> Dict[str, Any]:
    """Get top products by revenue in the last N days.

    Args:
        days: Number of days to look back (default 30).
        limit: Number of top products to return (default 10).
    """
    client = await ShopifyAnalyticsClient.initialize(_auth())
    
    start_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
    
    query = """
    query OrdersByProduct($query: String) {
      orders(first: 250, query: $query) {
        edges {
          node {
            id
            createdAt
            lineItems(first: 100) {
              edges {
                node {
                  title
                  sku
                  quantity
                  originalTotalSet {
                    shopMoney {
                      amount
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    """
    
    variables = {
        "query": f"created:>={start_date}"
    }
    
    result = await _shopify_graphql_request(client, query, variables)
    
    if "errors" in result:
        raise RuntimeError(f"GraphQL error: {result['errors']}")
    
    # Aggregate revenue by product
    product_revenue = {}
    orders = result.get("data", {}).get("orders", {}).get("edges", [])
    
    for order in orders:
        line_items = order.get("node", {}).get("lineItems", {}).get("edges", [])
        for item in line_items:
            node = item.get("node", {})
            title = node.get("title", "Unknown")
            revenue = float(node.get("originalTotalSet", {}).get("shopMoney", {}).get("amount", 0))
            quantity = node.get("quantity", 0)
            
            if title not in product_revenue:
                product_revenue[title] = {"revenue": 0, "quantity": 0}
            product_revenue[title]["revenue"] += revenue
            product_revenue[title]["quantity"] += quantity
    
    # Sort by revenue and limit
    sorted_products = sorted(
        product_revenue.items(),
        key=lambda x: x[1]["revenue"],
        reverse=True
    )[:limit]
    
    return {
        "period_days": days,
        "top_products": [
            {
                "product": name,
                "revenue": round(data["revenue"], 2),
                "quantity_sold": data["quantity"],
            }
            for name, data in sorted_products
        ],
    }


# ---------------------------------------------------------------------------
# 4. Get Sales by Day
# ---------------------------------------------------------------------------

async def shopify_get_sales_by_day(
    days: int = 30,
) -> Dict[str, Any]:
    """Get daily sales for the last N days (revenue per day).

    Args:
        days: Number of days to look back (default 30).
    """
    client = await ShopifyAnalyticsClient.initialize(_auth())
    
    start_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
    
    query = """
    query SalesByDay($query: String) {
      orders(first: 250, query: $query) {
        edges {
          node {
            id
            createdAt
            totalPriceSet {
              shopMoney {
                amount
              }
            }
          }
        }
      }
    }
    """
    
    variables = {
        "query": f"created:>={start_date}"
    }
    
    result = await _shopify_graphql_request(client, query, variables)
    
    if "errors" in result:
        raise RuntimeError(f"GraphQL error: {result['errors']}")
    
    # Aggregate by day
    daily_sales = {}
    orders = result.get("data", {}).get("orders", {}).get("edges", [])
    
    for order in orders:
        node = order.get("node", {})
        created_at = node.get("createdAt", "")[:10]  # YYYY-MM-DD
        revenue = float(node.get("totalPriceSet", {}).get("shopMoney", {}).get("amount", 0))
        
        if created_at not in daily_sales:
            daily_sales[created_at] = 0
        daily_sales[created_at] += revenue
    
    # Sort by date
    sorted_days = sorted(daily_sales.items())
    
    return {
        "period_days": days,
        "daily_sales": [
            {"date": date, "revenue": round(revenue, 2)}
            for date, revenue in sorted_days
        ],
    }


# ---------------------------------------------------------------------------
# 5. Get Inventory Health
# ---------------------------------------------------------------------------

async def shopify_get_inventory_health() -> Dict[str, Any]:
    """Get inventory health: total products, low-stock items, out-of-stock.
    
    Returns inventory status across all variants.
    """
    client = await ShopifyAnalyticsClient.initialize(_auth())
    
    query = """
    query InventoryHealth {
      products(first: 250) {
        edges {
          node {
            id
            title
            variants(first: 100) {
              edges {
                node {
                  id
                  sku
                  inventoryQuantity
                  inventoryManagement
                }
              }
            }
          }
        }
      }
    }
    """
    
    result = await _shopify_graphql_request(client, query)
    
    if "errors" in result:
        raise RuntimeError(f"GraphQL error: {result['errors']}")
    
    products = result.get("data", {}).get("products", {}).get("edges", [])
    
    total_skus = 0
    low_stock = []  
    out_of_stock = []  
    
    for product in products:
        variants = product.get("node", {}).get("variants", {}).get("edges", [])
        for variant in variants:
            node = variant.get("node", {})
            sku = node.get("sku", "No SKU")
            qty = node.get("inventoryQuantity", 0)
            title = product.get("node", {}).get("title", "Unknown")
            
            total_skus += 1
            
            if qty == 0:
                out_of_stock.append({"sku": sku, "product": title})
            elif qty < 10:
                low_stock.append({"sku": sku, "product": title, "quantity": qty})
    
    return {
        "total_skus": total_skus,
        "out_of_stock_count": len(out_of_stock),
        "low_stock_count": len(low_stock),
        "out_of_stock_items": out_of_stock[:20], 
        "low_stock_items": low_stock[:20],  
    }
