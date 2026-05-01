import datetime
import json
import os
from typing import Any, Dict, List, Optional, Union

from apify_client import ApifyClient
from langchain_core.tools import tool

MAX_TRENDS_RESULTS = 5


class _SafeEncoder(json.JSONEncoder):
    """JSON encoder that handles datetime, date, and pandas Timestamp objects."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, (datetime.datetime, datetime.date)):
            return obj.isoformat()
        try:
            import pandas as pd  # type: ignore
            if isinstance(obj, pd.Timestamp):
                return obj.isoformat()
        except ImportError:
            pass
        try:
            import numpy as np  # type: ignore
            if isinstance(obj, np.integer):
                return int(obj)
            if isinstance(obj, np.floating):
                return float(obj)
            if isinstance(obj, np.bool_):
                return bool(obj)
        except ImportError:
            pass
        return super().default(obj)


def _fetch_trends(
    keywords: Union[str, List[str]],
    *,
    geo: str = "US",
    time_range: str = "today 12-m",
    mode: str = "trending",
    category: str = "0",
    google_property: str = "",
    language: str = "en-US",
    timezone: str = "UTC",
    days_back: int = 1,
    max_results: int = MAX_TRENDS_RESULTS,
    apify_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    token = apify_token or os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN not set")

    # Normalise: actor expects a single string; join lists with a comma
    if isinstance(keywords, list):
        keywords = ", ".join(str(k) for k in keywords)

    run_input: Dict[str, Any] = {
        "mode": mode,
        "keywords": keywords,
        "geo": geo,
        "timeRange": time_range,
        "category": category,
        "googleProperty": google_property,
        "maxResults": max_results,
        "language": language,
        "timezone": timezone,
        "daysBack": days_back,
        "date": None,
    }

    client = ApifyClient(token)
    run = client.actor("xeDvp8Y8h5CF6a7y2").call(run_input=run_input)

    results: List[Dict[str, Any]] = []
    for item in client.dataset(run["defaultDatasetId"] if run else "").iterate_items():
        results.append(item)
        if len(results) >= max_results:
            break

    return results[:max_results]


@tool("google_trends", return_direct=False)
def google_trends(
    keywords: Union[str, List[str]],
    geo: str = "US",
    time_range: str = "today 12-m",
    mode: str = "trending",
    category: str = "0",
    google_property: str = "",
    language: str = "en-US",
    timezone: str = "UTC",
    days_back: int = 1,
) -> str:
    """
    Fetch Google Trends data via Apify.

    Args:
        keywords: Search keyword or phrase to analyse (e.g. 'motorcycle jacket').
        geo: Two-letter country code, e.g. 'US', 'GB', 'PK'. Default 'US'.
        time_range: Timeframe — 'today 12-m', 'today 3-m', 'today 5-y', 'now 7-d', etc.
        mode: Data mode — 'trending' for trending searches (default).
        category: Google Trends category ID as string, default '0' (all categories).
        google_property: Google property filter — '' (web), 'news', 'images', 'youtube', 'froogle'.
        language: Language code, e.g. 'en-US'.
        timezone: Timezone string, e.g. 'UTC'.
        days_back: Number of days back for trending searches (default 1).

    Returns:
        JSON string — list of up to 5 trending query records, each with:
        query, geo, approxTraffic, trafficValue.
    """
    items = _fetch_trends(
        keywords=keywords,
        geo=geo,
        time_range=time_range,
        mode=mode,
        category=category,
        google_property=google_property,
        language=language,
        timezone=timezone,
        days_back=days_back,
        max_results=MAX_TRENDS_RESULTS,
    )
    if not items:
        return json.dumps({
            "status": "unavailable",
            "message": (
                "Google Trends returned no data for the requested query. "
                "Google may be temporarily rate-limiting requests. "
                "Use alternative sources such as google_dork_search for trend insights."
            ),
        }, ensure_ascii=False)
    return json.dumps(items, cls=_SafeEncoder, ensure_ascii=False)


TARGET_AGENTS = ["product_researcher_agent"]
AGENT_TOOLS = {
    "product_researcher_agent": [google_trends],
}
