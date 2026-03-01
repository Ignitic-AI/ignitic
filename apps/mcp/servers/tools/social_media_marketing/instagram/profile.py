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

    return await client.request("GET", target_id, params={"fields": fields})
