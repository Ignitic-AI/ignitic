"""
Facebook Page post tools.

Covers:
- create_post        – publish a text post on the Page
- get_page_posts     – list recent posts on the Page
- delete_post        – permanently delete a post
- post_image         – publish an image post with a caption
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .client import FacebookPageClient, get_auth_from_headers


async def create_post(message: str) -> Dict[str, Any]:
    """
    Create a new text post on the Facebook Page.

    Args:
        message: The text content of the post.

    Returns:
        Dict containing the new post's ``id`` and ``permalink_url`` when it is
        available.
    """
    auth = get_auth_from_headers()
    client = await FacebookPageClient.build(auth)
    created = await client.request(
        "POST",
        f"{client.page_id}/feed",
        params={"message": message},
    )

    post_id = created.get("id")
    if not post_id:
        return created

    # Best effort: keep backward compatibility if link lookup fails.
    try:
        link_data = await client.request(
            "GET",
            post_id,
            params={"fields": "permalink_url"},
        )
    except Exception:
        return created

    permalink_url = link_data.get("permalink_url")
    if permalink_url:
        created["permalink_url"] = permalink_url
    return created


async def get_page_posts(
    limit: int = 25,
    page_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fetch the most recent posts on the Facebook Page.

    Args:
        limit: Maximum number of posts to return (default 25).
        page_token: Pagination cursor returned by a previous call.

    Returns:
        Dict with ``data`` (list of posts) and ``paging`` cursors.
    """
    auth = get_auth_from_headers()
    client = await FacebookPageClient.build(auth)
    params: Dict[str, Any] = {
        "fields": "id,message,created_time,full_picture,permalink_url",
        "limit": limit,
    }
    if page_token:
        params["after"] = page_token
    return await client.request("GET", f"{client.page_id}/posts", params=params)


async def delete_post(post_id: str) -> Dict[str, Any]:
    """
    Delete a specific post from the Facebook Page.

    Args:
        post_id: The ID of the post to delete.

    Returns:
        Dict with ``success`` boolean.
    """
    auth = get_auth_from_headers()
    client = await FacebookPageClient.build(auth)
    return await client.request("DELETE", post_id)


async def post_image(image_url: str, caption: str = "") -> Dict[str, Any]:
    """
    Post an image (by URL) with an optional caption to the Facebook Page.

    Args:
        image_url: A publicly accessible URL of the image to publish.
        caption: Optional text caption for the image.

    Returns:
        Dict with ``id`` (photo ID), ``post_id`` and ``permalink_url`` when
        it is available.
    """
    auth = get_auth_from_headers()
    client = await FacebookPageClient.build(auth)
    params: Dict[str, Any] = {"url": image_url}
    if caption:
        params["caption"] = caption
    created = await client.request("POST", f"{client.page_id}/photos", params=params)

    post_id = created.get("post_id")
    if not post_id:
        return created

    # Best effort: keep backward compatibility if link lookup fails.
    try:
        link_data = await client.request(
            "GET",
            post_id,
            params={"fields": "permalink_url"},
        )
    except Exception:
        return created

    permalink_url = link_data.get("permalink_url")
    if permalink_url:
        created["permalink_url"] = permalink_url
    return created
