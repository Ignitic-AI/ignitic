"""
Instagram media tools.

Covers:
- get_media_posts     – fetch recent posts from an Instagram account
- get_media_insights  – retrieve engagement metrics for a specific post
- publish_media       – upload and publish an image or video to Instagram
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .client import InstagramClient, get_auth_from_headers


async def get_media_posts(
    limit: int = 25,
    after: Optional[str] = None,
    account_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fetch recent media posts from an Instagram business account.

    Args:
        limit: Maximum number of posts to return (1-100, default 25).
        after: Pagination cursor returned by a previous call.
        account_id: Instagram Business Account ID. If omitted the
                    auto-detected account is used.

    Returns:
        Dict with ``data`` (list of media objects) and ``paging`` cursors.
    """
    auth = get_auth_from_headers()
    client = await InstagramClient.build(auth)

    target_id = account_id or client.ig_account_id

    fields = ",".join(
        [
            "id",
            "media_type",
            "media_url",
            "permalink",
            "thumbnail_url",
            "caption",
            "timestamp",
            "like_count",
            "comments_count",
        ]
    )

    params: Dict[str, Any] = {
        "fields": fields,
        "limit": min(limit, 100),
    }
    if after:
        params["after"] = after

    return await client.request("GET", f"{target_id}/media", params=params)


async def get_media_insights(
    media_id: str,
    metrics: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Retrieve engagement metrics (insights) for a specific Instagram post.

    Args:
        media_id: The Instagram media ID to get insights for.
        metrics: List of metric names to retrieve. Supported values include
                 ``reach``, ``likes``, ``comments``, ``shares``, ``saved``,
                 and ``video_views`` (video posts only).
                 If omitted all standard metrics are fetched.

    Returns:
        Dict with ``data`` containing the requested insight objects.
    """
    auth = get_auth_from_headers()
    client = await InstagramClient.build(auth)

    if not metrics:
        metrics = ["reach", "likes", "comments", "shares", "saved"]

    params: Dict[str, Any] = {"metric": ",".join(metrics)}

    return await client.request("GET", f"{media_id}/insights", params=params)


async def publish_media(
    image_url: Optional[str] = None,
    video_url: Optional[str] = None,
    caption: str = "",
    location_id: Optional[str] = None,
    account_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Upload and publish an image or video to the Instagram account.

    Publishing is a two-step process:
      1. Create a media container with the content URL and caption.
      2. Publish the container.

    Args:
        image_url: Publicly accessible URL of the image to publish.
                   Either ``image_url`` or ``video_url`` must be provided.
        video_url: Publicly accessible URL of the video to publish.
        caption: Optional caption text for the post.
        location_id: Optional Facebook location ID for geotagging.
        account_id: Instagram Business Account ID. If omitted the
                    auto-detected account is used.

    Returns:
        Dict with the published media ``id``.
    """
    if not image_url and not video_url:
        from fastmcp.exceptions import ToolError

        raise ToolError("Either 'image_url' or 'video_url' must be provided.")

    auth = get_auth_from_headers()
    client = await InstagramClient.build(auth)

    target_id = account_id or client.ig_account_id

    # Step 1 – create the media container
    container_params: Dict[str, Any] = {}
    if caption:
        container_params["caption"] = caption
    if image_url:
        container_params["image_url"] = image_url
    if video_url:
        container_params["video_url"] = video_url
        container_params["media_type"] = "VIDEO"
    if location_id:
        container_params["location_id"] = location_id

    container_resp = await client.request(
        "POST",
        f"{target_id}/media",
        params=container_params,
    )

    container_id = container_resp.get("id")
    if not container_id:
        from fastmcp.exceptions import ToolError

        raise ToolError(f"Failed to create media container: {container_resp}")

    # Step 2 – publish the container
    publish_resp = await client.request(
        "POST",
        f"{target_id}/media_publish",
        params={"creation_id": container_id},
    )

    return publish_resp
