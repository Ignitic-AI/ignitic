"""
Facebook Page engagement tools.

Covers:
- get_number_of_likes – count likes / reactions on a post
"""

from __future__ import annotations

from typing import Any, Dict

from .client import FacebookPageClient, get_auth_from_headers


async def get_number_of_likes(post_id: str) -> Dict[str, Any]:
    """
    Return the total number of likes (reactions) on a post.

    Args:
        post_id: The ID of the post.

    Returns:
        Dict with ``post_id`` and ``total_likes`` count.
    """
    auth = get_auth_from_headers()
    client = await FacebookPageClient.build(auth)
    result = await client.request(
        "GET",
        post_id,
        params={"fields": "likes.summary(true)"},
    )
    total = result.get("likes", {}).get("summary", {}).get("total_count", 0)
    return {"post_id": post_id, "total_likes": total}
