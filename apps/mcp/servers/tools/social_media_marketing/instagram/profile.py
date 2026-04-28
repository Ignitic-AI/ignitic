"""
Instagram profile tool.

Covers:
- get_profile_info – retrieve Instagram business profile details
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .client import InstagramClient, get_auth_from_headers


async def get_profile_info(account_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Retrieve Instagram business profile details including followers,
    bio, and account information.

    Args:
        account_id: Instagram Business Account ID. If omitted the
                    account linked to the first Facebook Page is used.

    Returns:
        Dict with profile fields such as ``id``, ``username``, ``name``,
        ``biography``, ``website``, ``profile_picture_url``,
        ``followers_count``, ``follows_count``, and ``media_count``.
        When available, includes latest post link fields:
        ``latest_post_id``, ``latest_post_permalink``,
        and ``latest_post_permalink_url``.
    """
    auth = get_auth_from_headers()
    client = await InstagramClient.build(auth)

    target_id = account_id or client.ig_account_id

    fields = ",".join(
        [
            "id",
            "username",
            "name",
            "biography",
            "website",
            "profile_picture_url",
            "followers_count",
            "follows_count",
            "media_count",
        ]
    )

    profile = await client.request("GET", target_id, params={"fields": fields})

    # Best effort: enrich profile payload with latest post permalink.
    try:
        media_resp = await client.request(
            "GET",
            f"{target_id}/media",
            params={"fields": "id,permalink", "limit": 1},
        )
        media_items = media_resp.get("data")
        if isinstance(media_items, list) and media_items:
            latest = media_items[0]
            if isinstance(latest, dict):
                latest_id = latest.get("id")
                latest_permalink = latest.get("permalink")
                if latest_id:
                    profile["latest_post_id"] = latest_id
                if latest_permalink:
                    profile["latest_post_permalink"] = latest_permalink
                    profile["latest_post_permalink_url"] = latest_permalink
    except Exception:
        pass

    return profile
