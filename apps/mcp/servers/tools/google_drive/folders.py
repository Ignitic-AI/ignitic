"""
Google Drive folder tools.

Covers:
- create_folder  – create a new folder
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .client import GoogleDriveClient, get_auth_from_headers

_DEFAULT_FILE_FIELDS = (
    "id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink, trashed"
)

FOLDER_MIME = "application/vnd.google-apps.folder"


async def create_folder(
    name: str,
    parent_folder_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new folder in Google Drive.

    Args:
        name: Name of the new folder.
        parent_folder_id: ID of the parent folder. Omit to create in the
                          root of "My Drive".

    Returns:
        Dict with the metadata of the created folder.
    """
    auth = get_auth_from_headers()
    service = await GoogleDriveClient.build_service(auth)

    body: Dict[str, Any] = {
        "name": name,
        "mimeType": FOLDER_MIME,
    }
    if parent_folder_id:
        body["parents"] = [parent_folder_id]

    result = service.files().create(body=body, fields=_DEFAULT_FILE_FIELDS).execute()
    return result
