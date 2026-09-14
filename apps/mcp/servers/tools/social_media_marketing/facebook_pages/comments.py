"""
Facebook Page comment tools.

Covers:
- get_post_comments       – list comments on a post
- get_number_of_comments  – count comments on a post
- reply_to_comment        – reply to an existing comment
"""

from __future__ import annotations

from typing import Any, Dict

from .client import FacebookPageClient, get_auth_from_headers


async def get_post_comments(
    post_id: str,
    limit: int = 25,
) -> Dict[str, Any]:
    """
    Retrieve comments for a given post.

    Args:
        post_id: The ID of the post whose comments to fetch.
        limit: Maximum number of comments to return (default 25).

    Returns:
        Dict with ``data`` (list of comment objects) and ``paging`` cursors.
    """
    auth = get_auth_from_headers()
    client = await FacebookPageClient.build(auth)
    return await client.request(
        "GET",
        f"{post_id}/comments",
        params={
            "fields": "id,message,from,created_time",
            "limit": limit,
        },
    )


async def get_number_of_comments(post_id: str) -> Dict[str, Any]:
    """
    Count the total number of comments on a given post.

    Args:
        post_id: The ID of the post.

    Returns:
        Dict with ``post_id`` and ``total_comments`` count.
    """
    auth = get_auth_from_headers()
    client = await FacebookPageClient.build(auth)
    result = await client.request(
        "GET",
        post_id,
        params={"fields": "comments.summary(true)"},
    )
    total = result.get("comments", {}).get("summary", {}).get("total_count", 0)
    return {"post_id": post_id, "total_comments": total}


async def reply_to_comment(comment_id: str, message: str) -> Dict[str, Any]:
    """
    Reply to a specific comment on a Facebook Page post.

    Args:
        comment_id: The ID of the comment to reply to.
        message: The reply text.

    Returns:
        Dict with the new reply comment ``id``.
    """
    auth = get_auth_from_headers()
    client = await FacebookPageClient.build(auth)
    return await client.request(
        "POST",
        f"{comment_id}/comments",
        params={"message": message},
    )
