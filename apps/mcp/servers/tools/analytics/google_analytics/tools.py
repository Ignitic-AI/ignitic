"""Google Analytics 4 tools for website traffic and conversion analysis.

All tools load credentials per-request via the user's JWT.
Requires Google OAuth saved in Secrets → googleAnalyticsOAuth2Api.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

from fastmcp.server.dependencies import get_http_headers

from .client import GoogleAnalytics4Client


def _auth() -> str:
    headers = get_http_headers()
    token = headers.get("Authorization") or headers.get("authorization") or ""
    if not token:
        raise ValueError("Authorization header missing")
    return token


# ---------------------------------------------------------------------------
# 1. Get Website Traffic (Sessions, Users, Page Views)
# ---------------------------------------------------------------------------

async def google_analytics_get_traffic(
    property_id: str,
    days: int = 30,
) -> Dict[str, Any]:
    """Get website traffic metrics: sessions, users, page views, bounce rate.

    Args:
        property_id: GA4 property ID (e.g., "properties/123456789")
        days: Number of days to look back (default 30).
    """
    client = await GoogleAnalytics4Client.initialize(_auth(), property_id)
    
    start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    end_date = datetime.utcnow().strftime("%Y-%m-%d")
    
    request_body = {
        "dateRanges": [{"startDate": start_date, "endDate": end_date}],
        "metrics": [
            {"name": "sessions"},
            {"name": "totalUsers"},
            {"name": "screenPageViews"},
            {"name": "bounceRate"},
            {"name": "averageSessionDuration"},
        ],
    }
    
    response = client.service.properties().runReport(
        property=property_id,
        body=request_body
    ).execute()
    
    if not response.get("rows"):
        return {
            "period_days": days,
            "start_date": start_date,
            "end_date": end_date,
            "data": "No data available for this period",
        }
    
    row = response["rows"][0]["metricValues"]
    
    return {
        "period_days": days,
        "start_date": start_date,
        "end_date": end_date,
        "sessions": int(row[0]["value"]),
        "total_users": int(row[1]["value"]),
        "page_views": int(row[2]["value"]),
        "bounce_rate_percent": round(float(row[3]["value"]), 2),
        "avg_session_duration_seconds": round(float(row[4]["value"]), 2),
    }


# ---------------------------------------------------------------------------
# 2. Get Conversion Metrics (Goals, Transactions)
# ---------------------------------------------------------------------------

async def google_analytics_get_conversions(
    property_id: str,
    days: int = 30,
) -> Dict[str, Any]:
    """Get conversion metrics: purchases, transactions, revenue, conversion rate.

    Args:
        property_id: GA4 property ID
        days: Number of days to look back (default 30).
    """
    client = await GoogleAnalytics4Client.initialize(_auth(), property_id)
    
    start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    end_date = datetime.utcnow().strftime("%Y-%m-%d")
    
    request_body = {
        "dateRanges": [{"startDate": start_date, "endDate": end_date}],
        "metrics": [
            {"name": "sessions"},
            {"name": "totalUsers"},
            {"name": "purchaseTransactionId"},  # Unique purchases
            {"name": "transactionRevenue"},
            {"name": "conversions"},
        ],
    }
    
    response = client.service.properties().runReport(
        property=property_id,
        body=request_body
    ).execute()
    
    if not response.get("rows"):
        return {
            "period_days": days,
            "data": "No conversion data available",
        }
    
    row = response["rows"][0]["metricValues"]
    sessions = int(row[0]["value"])
    transactions = int(row[2]["value"])
    revenue = float(row[3]["value"])
    conversions = int(row[4]["value"])
    
    conversion_rate = (conversions / sessions * 100) if sessions > 0 else 0
    avg_order_value = (revenue / transactions) if transactions > 0 else 0
    
    return {
        "period_days": days,
        "start_date": start_date,
        "end_date": end_date,
        "transactions": transactions,
        "revenue": round(revenue, 2),
        "conversions": conversions,
        "conversion_rate_percent": round(conversion_rate, 2),
        "average_order_value": round(avg_order_value, 2),
    }


# ---------------------------------------------------------------------------
# 3. Get Traffic by Source (Organic, Direct, Referral, Paid)
# ---------------------------------------------------------------------------

async def google_analytics_get_traffic_by_source(
    property_id: str,
    days: int = 30,
) -> Dict[str, Any]:
    """Get traffic breakdown by source: organic, direct, paid, referral.

    Args:
        property_id: GA4 property ID
        days: Number of days to look back (default 30).
    """
    client = await GoogleAnalytics4Client.initialize(_auth(), property_id)
    
    start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    end_date = datetime.utcnow().strftime("%Y-%m-%d")
    
    request_body = {
        "dateRanges": [{"startDate": start_date, "endDate": end_date}],
        "dimensions": [{"name": "sessionSource"}],
        "metrics": [
            {"name": "sessions"},
            {"name": "totalUsers"},
            {"name": "conversions"},
        ],
        "orderBys": [{"metric": {"metricName": "sessions"}, "desc": True}],
        "limit": 10,
    }
    
    response = client.service.properties().runReport(
        property=property_id,
        body=request_body
    ).execute()
    
    traffic_sources = []
    total_sessions = 0
    
    for row in response.get("rows", []):
        source = row["dimensionValues"][0]["value"]
        sessions = int(row["metricValues"][0]["value"])
        conversions = int(row["metricValues"][2]["value"])
        total_sessions += sessions
        
        traffic_sources.append({
            "source": source,
            "sessions": sessions,
            "conversions": conversions,
        })
    
    # Add percentage
    for source in traffic_sources:
        source["percent_of_traffic"] = round((source["sessions"] / total_sessions * 100), 2) if total_sessions > 0 else 0
    
    return {
        "period_days": days,
        "total_sessions": total_sessions,
        "traffic_by_source": traffic_sources,
    }


# ---------------------------------------------------------------------------
# 4. Get Top Pages
# ---------------------------------------------------------------------------

async def google_analytics_get_top_pages(
    property_id: str,
    days: int = 30,
    limit: int = 10,
) -> Dict[str, Any]:
    """Get top performing pages by views and conversions.

    Args:
        property_id: GA4 property ID
        days: Number of days to look back (default 30).
        limit: Number of top pages to return (default 10).
    """
    client = await GoogleAnalytics4Client.initialize(_auth(), property_id)
    
    start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    end_date = datetime.utcnow().strftime("%Y-%m-%d")
    
    request_body = {
        "dateRanges": [{"startDate": start_date, "endDate": end_date}],
        "dimensions": [{"name": "pagePathAndQueryString"}],
        "metrics": [
            {"name": "screenPageViews"},
            {"name": "totalUsers"},
            {"name": "bounceRate"},
            {"name": "conversions"},
        ],
        "orderBys": [{"metric": {"metricName": "screenPageViews"}, "desc": True}],
        "limit": limit,
    }
    
    response = client.service.properties().runReport(
        property=property_id,
        body=request_body
    ).execute()
    
    top_pages = []
    for row in response.get("rows", []):
        page = row["dimensionValues"][0]["value"]
        views = int(row["metricValues"][0]["value"])
        users = int(row["metricValues"][1]["value"])
        bounce_rate = float(row["metricValues"][2]["value"])
        conversions = int(row["metricValues"][3]["value"])
        
        top_pages.append({
            "page": page,
            "views": views,
            "users": users,
            "bounce_rate_percent": round(bounce_rate, 2),
            "conversions": conversions,
        })
    
    return {
        "period_days": days,
        "top_pages": top_pages,
    }


# ---------------------------------------------------------------------------
# 5. Get Traffic by Device
# ---------------------------------------------------------------------------

async def google_analytics_get_traffic_by_device(
    property_id: str,
    days: int = 30,
) -> Dict[str, Any]:
    """Get traffic breakdown by device: desktop, mobile, tablet.

    Args:
        property_id: GA4 property ID
        days: Number of days to look back (default 30).
    """
    client = await GoogleAnalytics4Client.initialize(_auth(), property_id)
    
    start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    end_date = datetime.utcnow().strftime("%Y-%m-%d")
    
    request_body = {
        "dateRanges": [{"startDate": start_date, "endDate": end_date}],
        "dimensions": [{"name": "deviceCategory"}],
        "metrics": [
            {"name": "sessions"},
            {"name": "totalUsers"},
            {"name": "bounceRate"},
            {"name": "conversions"},
            {"name": "transactionRevenue"},
        ],
    }
    
    response = client.service.properties().runReport(
        property=property_id,
        body=request_body
    ).execute()
    
    device_data = []
    for row in response.get("rows", []):
        device = row["dimensionValues"][0]["value"]
        sessions = int(row["metricValues"][0]["value"])
        users = int(row["metricValues"][1]["value"])
        bounce_rate = float(row["metricValues"][2]["value"])
        conversions = int(row["metricValues"][3]["value"])
        revenue = float(row["metricValues"][4]["value"])
        
        device_data.append({
            "device": device,
            "sessions": sessions,
            "users": users,
            "bounce_rate_percent": round(bounce_rate, 2),
            "conversions": conversions,
            "revenue": round(revenue, 2),
        })
    
    return {
        "period_days": days,
        "device_breakdown": device_data,
    }
