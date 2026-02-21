"""
Google Drive permissions / sharing tools.

Covers:
- share_file        - grant access to a file or folder
- list_permissions  - list who has access to a file
- remove_permission - revoke a specific permission
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .client import GoogleDriveClient, get_auth_from_headers


async def share_file(
    file_id: str,
    email: str,
    role: str = "reader",
    send_notification: bool = True,
    message: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Share a file or folder with a specific user.

    Args:
        file_id: The ID of the file or folder to share.
        email: The email address of the user to share with.
        role: Access level to grant. One of:
              ``"reader"`` (view-only, default),
              ``"commenter"`` (view + comment),
              ``"writer"`` (edit),
              ``"fileOrganizer"`` (organise in shared drives),
              ``"owner"`` (transfer ownership - use carefully).
        send_notification: Whether to send an email notification to the user
                           (default ``True``).
        message: Optional personal message to include in the notification email.

    Returns:
        Dict containing the created permission object.
    """
    auth = get_auth_from_headers()
    service = await GoogleDriveClient.build_service(auth)

    permission_body: Dict[str, Any] = {
        "type": "user",
        "role": role,
        "emailAddress": email,
    }

    kwargs: Dict[str, Any] = {
        "fileId": file_id,
        "body": permission_body,
        "sendNotificationEmail": send_notification,
        "fields": "id, type, role, emailAddress, displayName",
    }
    if message:
        kwargs["emailMessage"] = message

    result = service.permissions().create(**kwargs).execute()
    return result


async def list_permissions(file_id: str) -> Dict[str, Any]:
    """
    List all permissions (sharing settings) for a file or folder.

    Args:
        file_id: The ID of the file or folder.

    Returns:
        Dict with ``file_id`` and ``permissions`` list.
    """
    auth = get_auth_from_headers()
    service = await GoogleDriveClient.build_service(auth)

    result = (
        service.permissions()
        .list(
            fileId=file_id,
            fields="permissions(id, type, role, emailAddress, displayName, domain)",
        )
        .execute()
    )
    return {
        "file_id": file_id,
        "permissions": result.get("permissions", []),
    }


async def remove_permission(
    file_id: str,
    permission_id: str,
) -> Dict[str, Any]:
    """
    Remove (revoke) a specific permission from a file or folder.

    Args:
        file_id: The ID of the file or folder.
        permission_id: The ID of the permission to remove (obtained from
                       ``list_permissions``).

    Returns:
        Dict confirming removal with ``file_id``, ``permission_id`` and
        ``status``.
    """
    auth = get_auth_from_headers()
    service = await GoogleDriveClient.build_service(auth)

    service.permissions().delete(fileId=file_id, permissionId=permission_id).execute()
    return {"file_id": file_id, "permission_id": permission_id, "status": "removed"}
