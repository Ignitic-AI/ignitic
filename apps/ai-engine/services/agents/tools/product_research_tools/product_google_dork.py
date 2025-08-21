import json
from typing import List, Dict
import requests
from bs4 import BeautifulSoup
from langchain_core.tools import tool
from urllib.parse import urlparse, parse_qs, unquote


def _unwrap_duckduckgo_url(url: str) -> str:
    """Convert DuckDuckGo redirect URLs to direct destination URLs and normalize scheme."""
    if not url:
        return url
    if url.startswith("//"):
        url = "https:" + url
    try:
        parsed = urlparse(url)
        if parsed.netloc.endswith("duckduckgo.com") and parsed.path.startswith("/l/"):
            qs = parse_qs(parsed.query)
            uddg = qs.get("uddg", [None])[0]
            if uddg:
                direct = unquote(uddg)
                # Ensure scheme
                if direct.startswith("//"):
                    direct = "https:" + direct
                return direct
    except Exception:
        pass
    return url


def _duckduckgo_search(query: str, num_results: int) -> List[Dict[str, str]]:
    search_url = "https://duckduckgo.com/html/"
    params = {"q": query}
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        " AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    }
    try:
        resp = requests.get(search_url, params=params, headers=headers, timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        results = []
        for result in soup.select("div.result"):
            a = result.select_one("a.result__a")
            if not a:
                continue
            url = _unwrap_duckduckgo_url(a.get("href", ""))
            title = a.get_text(strip=True)
            snippet_tag = result.select_one("div.result__snippet") or result.select_one(
                "a.result__snippet"
            )
            snippet = snippet_tag.get_text(strip=True) if snippet_tag else ""
            if url:
                results.append({"title": title, "url": url, "snippet": snippet})
            if len(results) >= num_results:
                break
        return results
    except Exception:
        return []


def _fetch_content_excerpt(url: str, max_chars: int = 500) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        " AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        # Remove scripts/styles
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = " ".join(soup.get_text(separator=" ").split())
        return text[:max_chars]
    except Exception:
        return ""


@tool("google_dork_search", return_direct=False)
def google_dork_search(query: str, num_results: int = 5) -> str:
    """
    Perform a DuckDuckGo web search and return top results with brief content excerpts.

    Args:
        query: The search query, supports advanced operators ("dorks").
        num_results: Number of results to return (default 5).

    Returns:
        JSON string with list of {title, url, snippet, content_excerpt}.
    """

    items = _duckduckgo_search(query, num_results)

    enriched = []
    for it in items:
        direct_url = it.get("url", "")
        excerpt = _fetch_content_excerpt(direct_url) if direct_url else ""
        enriched.append(
            {
                "title": it.get("title", ""),
                "url": direct_url,
                "snippet": it.get("snippet", ""),
                "content_excerpt": excerpt,
            }
        )

    return json.dumps(enriched, ensure_ascii=False)


TARGET_AGENTS = ["product_researcher_agent"]
AGENT_TOOLS = {
    "product_researcher_agent": [google_dork_search],
}


