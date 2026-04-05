"""Alibaba.com supplier discovery via Apify — LangChain tool wrapper."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

from apify_client import ApifyClient
from langchain_core.tools import tool

_ALIBABA_SUPPLIER_ACTOR_ID = "A8m056ZMIl1vgaaWk"
_MAX_PAGES = 1


def _standardize_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize raw Apify actor rows to a stable schema (same idea as apify_amazon_search)."""
    raw_tags = item.get("service_tags")
    if isinstance(raw_tags, str) and raw_tags.strip():
        service_tags: List[str] = [raw_tags.strip()]
    elif isinstance(raw_tags, list):
        service_tags = [str(t) for t in raw_tags if t is not None and str(t).strip()]
    else:
        service_tags = []

    return {
        "searchQuery": item.get("search_query"),
        "companyId": item.get("company_id"),
        "name": item.get("name") or item.get("company_name"),
        "country": item.get("country"),
        "countryCode": item.get("country_code"),
        "yearsAsGoldSupplier": item.get("years_as_gold_supplier"),
        "companyIconUrl": item.get("company_icon"),
        "profileUrl": item.get("profile_url"),
        "totalEmployees": item.get("total_employees"),
        "factorySize": item.get("factory_size"),
        "annualRevenue": item.get("annual_revenue"),
        "responseRate": item.get("response_rate"),
        "isAssessedSupplier": item.get("is_assessed_supplier"),
        "isVerifiedSupplierPro": item.get("is_verified_supplier_pro"),
        "productsOffered": item.get("products_offered"),
        "reviewCount": item.get("review_count"),
        "reviewScore": item.get("review_score"),
        "serviceTags": service_tags,
    }


def _parse_queries(queries: str) -> List[str]:
    parts = [p.strip() for p in queries.replace("\n", ",").split(",") if p.strip()]
    if not parts:
        raise ValueError("queries must include at least one non-empty search term")
    return parts


def _optional_tags(service_tags: Optional[str]) -> Optional[List[str]]:
    if not service_tags or not str(service_tags).strip():
        return None
    tags = [t.strip() for t in str(service_tags).split(",") if t.strip()]
    return tags or None


def _run_alibaba_supplier_scraper(
    queries: List[str],
    *,
    min_years_as_gold_supplier: Optional[int] = None,
    assessed_supplier_only: bool = False,
    service_tags: Optional[str] = None,
    max_results: int = 100,
    apify_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    token = apify_token or os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN not set")

    run_input: Dict[str, Any] = {"queries": queries, "max_pages": _MAX_PAGES}
    if min_years_as_gold_supplier is not None:
        run_input["min_years_as_gold_supplier"] = int(min_years_as_gold_supplier)
    if assessed_supplier_only:
        run_input["assessed_supplier_only"] = True
    tags = _optional_tags(service_tags)
    if tags:
        run_input["service_tags"] = tags

    client = ApifyClient(token)
    run = client.actor(_ALIBABA_SUPPLIER_ACTOR_ID).call(run_input=run_input)

    if not run or not run.get("defaultDatasetId"):
        return []

    out: List[Dict[str, Any]] = []
    for raw in client.dataset(run["defaultDatasetId"]).iterate_items():
        if isinstance(raw, dict):
            out.append(_standardize_item(raw))
        if len(out) >= max_results:
            break
    return out[:max_results]


@tool("apify_alibaba_supplier_search", return_direct=False)
def apify_alibaba_supplier_search(
    queries: str,
    min_years_as_gold_supplier: Optional[int] = None,
    assessed_supplier_only: bool = False,
    service_tags: Optional[str] = None,
    max_results: int = 100,
) -> str:
    """
    Search Alibaba.com for suppliers/manufacturers via Apify. Returns JSON list of standardized supplier records
    (searchQuery, companyId, name, country, countryCode, yearsAsGoldSupplier, companyIconUrl, profileUrl,
    totalEmployees, factorySize, annualRevenue, responseRate, isAssessedSupplier, isVerifiedSupplierPro,
    productsOffered, reviewCount, reviewScore, serviceTags).

    Pagination is fixed to exactly one page (max_pages=1); cannot be increased.

    Args:
        queries: Comma-separated product search phrases.
        min_years_as_gold_supplier: Optional minimum years as Gold Supplier.
        assessed_supplier_only: Prefer assessed-only results when supported.
        service_tags: Optional comma-separated tags (e.g. "OEM Service, ODM Service").
        max_results: Cap on rows returned (default 100).
    """
    qlist = _parse_queries(queries)
    items = _run_alibaba_supplier_scraper(
        qlist,
        min_years_as_gold_supplier=min_years_as_gold_supplier,
        assessed_supplier_only=assessed_supplier_only,
        service_tags=service_tags,
        max_results=max_results,
    )
    return json.dumps(items, ensure_ascii=False)


TARGET_AGENTS = ["product_researcher_agent"]
AGENT_TOOLS = {
    "product_researcher_agent": [apify_alibaba_supplier_search],
}
