import json
import os
from typing import Any, Dict, List, Optional

from apify_client import ApifyClient


def _run_tiktok_trends_actor(
    country: str,
    number_of_videos: int,
    *,
    download_cover_image: bool = False,
    download_video: bool = False,
    generate_permalinks: bool = False,
    use_apify_proxy: bool = True,
    proxy_type: str = "RESIDENTIAL",
    webhook_url: Optional[str] = None,
    apify_token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Call the TikTok Trends actor on Apify and return parsed results.

    Args:
        country: Target country for trending videos (e.g., "United States").
        number_of_videos: Desired number of trending videos (capped for safety).
        download_cover_image: Whether to include cover image URLs.
        download_video: Whether to include no-watermark video URLs.
        generate_permalinks: Whether to generate permanent storage links.
        use_apify_proxy: Use Apify proxy (recommended).
        proxy_type: "DATACENTER" or "RESIDENTIAL".
        webhook_url: Optional webhook to receive scraped data.
        apify_token: Override for APIFY_TOKEN env var.

    Returns:
        List of standardized trend dictionaries.
    """
    token = apify_token or os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN not set")

    # Cap to 20 for cost/safety (actor allows 1-100)
    safe_count = max(1, min(int(number_of_videos), 20))

    client = ApifyClient(token)
    run_input = {
        "country": country,
        "numberOfVideos": safe_count,
        "downloadCoverImage": bool(download_cover_image),
        "downloadVideo": bool(download_video),
        "generatePermalinks": bool(generate_permalinks),
        "useApifyProxy": bool(use_apify_proxy),
        "proxyType": proxy_type,
        "proxies": None,
        "webhookUrl": webhook_url,
    }

    run = client.actor("4c0AIJ3u64yrlWj9S").call(run_input=run_input)

    results: List[Dict[str, Any]] = []
    dataset_id = run.get("defaultDatasetId")
    if dataset_id:
        for item in client.dataset(dataset_id).iterate_items():
            if not isinstance(item, dict):
                continue
            results.append(
                {
                    "video_id": item.get("video_id"),
                    "url": item.get("url"),
                    "title": item.get("title"),
                    "author": item.get("author"),
                    "author_nickname": item.get("author_nickname"),
                    "views": item.get("views"),
                    "likes": item.get("likes"),
                    "shares": item.get("shares"),
                    "comments": item.get("comments"),
                    "trending_position": item.get("trending_position"),
                    "country": item.get("country"),
                    "stats": item.get("stats"),
                    "media_urls": item.get("media_urls"),
                    "music": item.get("music"),
                    "created_at": item.get("created_at"),
                    "permalink": item.get("permalink"),
                }
            )
            if len(results) >= safe_count:
                break

    return results


def tiktok_trends(
    country: str = "United States",
    number_of_videos: int = 10,
    download_cover_image: bool = False,
    download_video: bool = False,
    generate_permalinks: bool = False,
    use_apify_proxy: bool = True,
    proxy_type: str = "RESIDENTIAL",
    webhook_url: Optional[str] = None,
) -> str:
    """
    Fetch TikTok trending videos for a given country using the Apify actor.

    Args:
        country: Target country (default: "United States").
        number_of_videos: How many videos to fetch (capped at 20).
        download_cover_image: Include cover image URLs.
        download_video: Include no-watermark video URLs.
        generate_permalinks: Generate permanent links.
        use_apify_proxy: Use Apify proxy (recommended).
        proxy_type: "DATACENTER" or "RESIDENTIAL".
        webhook_url: Optional webhook to receive scraped data.

    Returns:
        JSON string list of trending videos with metadata.
    """
    items = _run_tiktok_trends_actor(
        country=country,
        number_of_videos=number_of_videos,
        download_cover_image=download_cover_image,
        download_video=download_video,
        generate_permalinks=generate_permalinks,
        use_apify_proxy=use_apify_proxy,
        proxy_type=proxy_type,
        webhook_url=webhook_url,
    )
    return json.dumps(items, ensure_ascii=False)


# Auto-discovery hints
TARGET_AGENTS = ["marketer_agent"]
AGENT_TOOLS = {
    "marketer_agent": [tiktok_trends],
}

