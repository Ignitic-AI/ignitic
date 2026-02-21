"""
Google Drive file-upload / content-update tools.

Covers:
- create_text_file    - create a new plain-text file
- update_file_content - overwrite the content of an existing text file
"""

from __future__ import annotations

import io
from typing import Any, Dict, Optional

from googleapiclient.http import MediaIoBaseUpload

from .client import GoogleDriveClient, get_auth_from_headers

_DEFAULT_FILE_FIELDS = (
    "id, name, mimeType, size, modifiedTime, createdTime, "
    "parents, webViewLink, webContentLink"
)


async def create_text_file(
    name: str,
    content: str,
    mime_type: str = "text/plain",
    parent_folder_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new text file in Google Drive with the given content.

    Args:
        name: File name including extension, e.g. ``"notes.txt"``.
        content: Text content to write into the file.
        mime_type: MIME type of the content (default ``"text/plain"``).
                   Use ``"text/csv"`` for CSV, ``"application/json"`` for JSON,
                   etc.
        parent_folder_id: ID of the parent folder. Omit to upload to "My Drive"
                          root.

    Returns:
        Dict with the metadata of the newly created file.
    """
    auth = get_auth_from_headers()
    service = await GoogleDriveClient.build_service(auth)

    metadata: Dict[str, Any] = {"name": name}
    if parent_folder_id:
        metadata["parents"] = [parent_folder_id]

    media = MediaIoBaseUpload(
        io.BytesIO(content.encode("utf-8")),
        mimetype=mime_type,
        resumable=False,
    )

    result = (
        service.files()
        .create(body=metadata, media_body=media, fields=_DEFAULT_FILE_FIELDS)
        .execute()
    )
    return result


async def update_file_content(
    file_id: str,
    content: str,
    mime_type: str = "text/plain",
    new_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Overwrite the content of an existing file in Google Drive.

    Args:
        file_id: The ID of the file to update.
        content: New text content to write.
        mime_type: MIME type of the new content (default ``"text/plain"``).
        new_name: Optional new name for the file.

    Returns:
        Dict with the updated file metadata.
    """
    auth = get_auth_from_headers()
    service = await GoogleDriveClient.build_service(auth)

    media = MediaIoBaseUpload(
        io.BytesIO(content.encode("utf-8")),
        mimetype=mime_type,
        resumable=False,
    )

    body: Dict[str, Any] = {}
    if new_name:
        body["name"] = new_name

    result = (
        service.files()
        .update(
            fileId=file_id,
            body=body,
            media_body=media,
            fields=_DEFAULT_FILE_FIELDS,
        )
        .execute()
    )
    return result
