"""Alibaba.com wholesale product search via Apify — LangChain tool wrapper."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

from apify_client import ApifyClient
from langchain_core.tools import tool

_ALIBABA_PRODUCTS_ACTOR = "devcake/alibaba-products-scraper"
_MAX_PAGES = 1


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


def _as_bool(v: Any) -> bool:
    if isinstance(v, bool):
        return v
    if v in (1, "1", "true", "True", "yes"):
        return True
    if v in (0, "0", "false", "False", "no", None, ""):
        return False
    return bool(v)


def _standardize_item(item: Dict[str, Any]) -> Dict[str, Any]:
    price_lo = item.get("price_min")
    price_hi = item.get("price_max")
    if price_lo is None and item.get("price") is not None:
        price_lo = item.get("price")
        price_hi = item.get("price")

    return {
        "search_query": item.get("search_query")
        or item.get("query")
        or item.get("searchQuery"),
        "name": item.get("name")
        or item.get("title")
        or item.get("product_title")
        or item.get("productTitle"),
        "price_min": _as_float(price_lo),
        "price_max": _as_float(price_hi),
        "currency": item.get("currency") or "USD",
        "moq": _as_int(item.get("moq") or item.get("min_order_quantity") or item.get("minOrderQuantity")),
        "product_url": item.get("product_url")
        or item.get("url")
        or item.get("link")
        or item.get("productUrl"),
        "main_image": item.get("main_image")
        or item.get("image")
        or item.get("image_url")
        or item.get("img")
        or item.get("mainImage"),
        "company_name": item.get("company_name")
        or item.get("supplier_name")
        or item.get("supplierName")
        or item.get("company"),
        "years_as_gold_supplier": _as_int(
            item.get("years_as_gold_supplier") or item.get("yearsAsGoldSupplier")
        ),
        "supplier_service_score": _as_float(
            item.get("supplier_service_score")
            or item.get("service_score")
            or item.get("supplierServiceScore")
        ),
        "is_alibaba_guaranteed": _as_bool(
            item.get("is_alibaba_guaranteed") if item.get("is_alibaba_guaranteed") is not None
            else item.get("alibaba_guaranteed")
        ),
        "is_trade_assurance": _as_bool(
            item.get("is_trade_assurance")
            if item.get("is_trade_assurance") is not None
            else item.get("trade_assurance")
        ),
        "is_verified_supplier": _as_bool(
            item.get("is_verified_supplier")
            if item.get("is_verified_supplier") is not None
            else item.get("verified_supplier")
        ),
        "review_count": _as_int(item.get("review_count") or item.get("reviewCount")),
        "review_score": _as_float(item.get("review_score") or item.get("reviewScore")),
        "orders_count": _as_int(
            item.get("orders_count") or item.get("order_count") or item.get("ordersCount")
        ),
    }


def _parse_queries(queries: str) -> List[str]:
    parts = [p.strip() for p in queries.replace("\n", ",").split(",") if p.strip()]
    if not parts:
        raise ValueError("queries must include at least one non-empty search term")
    return parts


def _run_alibaba_product_scraper(
    queries: List[str],
    *,
    filter_moq_min: Optional[float] = None,
    filter_price_min_usd: Optional[float] = None,
    filter_price_max_usd: Optional[float] = None,
    trade_assurance: bool = False,
    verified_supplier: bool = False,
    alibaba_guaranteed: bool = False,
    start_page: int = 1,
    max_results: int = 60,
    apify_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    token = apify_token or os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN not set")

    run_input: Dict[str, Any] = {
        "queries": queries,
        "max_pages": _MAX_PAGES,
        "start_page": max(1, int(start_page)),
        "trade_assurance": bool(trade_assurance),
        "verified_supplier": bool(verified_supplier),
        "alibaba_guaranteed": bool(alibaba_guaranteed),
    }
    if filter_moq_min is not None:
        run_input["moq_min"] = float(filter_moq_min)
    if filter_price_min_usd is not None:
        run_input["price_min"] = float(filter_price_min_usd)
    if filter_price_max_usd is not None:
        run_input["price_max"] = float(filter_price_max_usd)

    client = ApifyClient(token)
    run = client.actor(_ALIBABA_PRODUCTS_ACTOR).call(run_input=run_input)

    if not run or not run.get("defaultDatasetId"):
        return []

    out: List[Dict[str, Any]] = []
    for raw in client.dataset(run["defaultDatasetId"]).iterate_items():
        if isinstance(raw, dict):
            out.append(_standardize_item(raw))
        if len(out) >= max_results:
            break
    return out[:max_results]


@tool("apify_alibaba_product_search", return_direct=False)
def apify_alibaba_product_search(
    queries: str,
    filter_moq_min: Optional[float] = None,
    filter_price_min_usd: Optional[float] = None,
    filter_price_max_usd: Optional[float] = None,
    trade_assurance: bool = False,
    verified_supplier: bool = False,
    alibaba_guaranteed: bool = False,
    start_page: int = 1,
    max_results: int = 60,
) -> str:
    """
    Search Alibaba.com for wholesale products via Apify. Returns JSON list with fields:
    search_query, name, price_min, price_max, currency, moq, product_url, main_image, company_name,
    years_as_gold_supplier, supplier_service_score, is_alibaba_guaranteed, is_trade_assurance,
    is_verified_supplier, review_count, review_score, orders_count. max_pages is always 1.
    """
    qlist = _parse_queries(queries)
    items = _run_alibaba_product_scraper(
        qlist,
        filter_moq_min=filter_moq_min,
        filter_price_min_usd=filter_price_min_usd,
        filter_price_max_usd=filter_price_max_usd,
        trade_assurance=trade_assurance,
        verified_supplier=verified_supplier,
        alibaba_guaranteed=alibaba_guaranteed,
        start_page=start_page,
        max_results=max_results,
    )
    return json.dumps(items, ensure_ascii=False)


TARGET_AGENTS = ["product_researcher_agent"]
AGENT_TOOLS = {
    "product_researcher_agent": [apify_alibaba_product_search],
}
