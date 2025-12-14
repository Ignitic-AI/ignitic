import json
import time
from typing import Any, Dict, List, Optional


def _safe_import_pytrends_and_pandas():
    try:
        from pytrends.request import TrendReq  # type: ignore
    except Exception as e:  # pragma: no cover - import-time error path
        raise RuntimeError(
            "pytrends is required for google_trends tool. Please install 'pytrends'."
        ) from e
    try:
        import pandas as pd  # type: ignore
    except Exception as e:  # pragma: no cover - import-time error path
        raise RuntimeError(
            "pandas is required for google_trends tool. Please install 'pandas'."
        ) from e
    return TrendReq


def _serialize_value(value: Any) -> Any:
    try:
        import pandas as pd  # type: ignore
        import numpy as np  # type: ignore
    except Exception:
        pd = None
        np = None

    # Pandas DataFrame/Series handling
    if 'pandas' in str(type(value)):
        try:
            # DataFrame
            if hasattr(value, "to_dict") and hasattr(value, "columns"):
                return value.reset_index().to_dict(orient="records")
            # Series
            if hasattr(value, "to_dict") and not hasattr(value, "columns"):
                return dict(value)
        except Exception:
            return str(value)

    # Numpy types
    if np is not None and isinstance(value, (
        getattr(np, "integer", int),
        getattr(np, "floating", float),
        getattr(np, "bool_", bool),
    )):
        try:
            return value.item()  # type: ignore[attr-defined]
        except Exception:
            return float(value) if isinstance(value, float) else int(value)

    if isinstance(value, (dict, list, str, int, float, bool)) or value is None:
        return value

    return str(value)


def _serialize_result(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {str(k): _serialize_result(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize_result(v) for v in obj]
    return _serialize_value(obj)


def _fetch_trends(
    endpoint: str,
    *,
    country: str = "US",
    keywords: Optional[List[str]] = None,
    timeframe: str = "now 7-d",
    gprop: str = "",
) -> Dict[str, Any]:
    TrendReq = _safe_import_pytrends_and_pandas()
    pytrends = TrendReq(hl="en-US", tz=0)

    aliases = {
        "iot": "interest_over_time",
        "ibr": "interest_by_region",
        "rq": "related_queries",
        "rt": "related_topics",
        "ts": "trending_searches",
        "rts": "realtime_trending_searches",
    }
    endpoint_resolved = aliases.get(endpoint.lower(), endpoint)

    if endpoint_resolved in [
        "interest_over_time",
        "interest_by_region",
        "related_queries",
        "related_topics",
    ]:
        if not keywords:
            raise ValueError(f"Endpoint '{endpoint_resolved}' requires keywords")
        last_err: Optional[Exception] = None
        for attempt in range(3):
            try:
                pytrends.build_payload(
                    kw_list=keywords,
                    timeframe=timeframe,
                    geo=country,
                    gprop=gprop,
                )
                break
            except Exception as e:
                last_err = e
                time.sleep(1.5 * (attempt + 1))
        else:
            raise RuntimeError(
                "Failed to build payload after retries. "
                "Check timeframe/geo/keywords. Details: {0}".format(last_err)
            )

    if endpoint_resolved == "interest_over_time":
        data = pytrends.interest_over_time()
        return {"endpoint": endpoint_resolved, "data": _serialize_result(data)}
    elif endpoint_resolved == "interest_by_region":
        data = pytrends.interest_by_region(resolution="region")
        return {"endpoint": endpoint_resolved, "data": _serialize_result(data)}
    elif endpoint_resolved == "related_queries":
        data = pytrends.related_queries()
        return {"endpoint": endpoint_resolved, "data": _serialize_result(data)}
    elif endpoint_resolved == "related_topics":
        data = pytrends.related_topics()
        return {"endpoint": endpoint_resolved, "data": _serialize_result(data)}
    elif endpoint_resolved == "trending_searches":
        data = pytrends.trending_searches(pn=country.lower())
        return {"endpoint": endpoint_resolved, "data": _serialize_result(data)}
    elif endpoint_resolved == "realtime_trending_searches":
        data = pytrends.realtime_trending_searches(pn=country.upper(), count=100)
        return {"endpoint": endpoint_resolved, "data": _serialize_result(data)}
    else:
        raise ValueError(f"Unknown endpoint: {endpoint}")


def google_trends(
    endpoint: str,
    country: str = "US",
    keywords: Optional[List[str]] = None,
    timeframe: str = "now 7-d",
    gprop: str = "",
) -> str:
    """
    Fetch stats from Google Trends via pytrends.

    Args:
        endpoint: One of [iot, ibr, rq, rt, ts, rts] or full names.
        country: Geo code like 'US', 'PK', 'GB'.
        keywords: Required for iot/ibr/rq/rt when payload is needed.
        timeframe: e.g. 'now 7-d', 'today 12-m'.
        gprop: '', 'images', 'news', 'youtube', 'froogle'.

    Returns:
        JSON string with keys: endpoint, data (JSON-serializable).
    """
    result = _fetch_trends(
        endpoint=endpoint,
        country=country,
        keywords=keywords,
        timeframe=timeframe,
        gprop=gprop,
    )
    return json.dumps(result, ensure_ascii=False)


TARGET_AGENTS = ["product_researcher_agent"]
AGENT_TOOLS = {
    "product_researcher_agent": [google_trends],
}


