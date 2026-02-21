"""
Google Drive file-level tools.

Covers:
- search_files        - full-text search across Drive
- list_files          - list files (optionally inside a folder)
- get_file_metadata   - fetch metadata for a single file
- read_file_content   - download / export file content as text
- delete_file         - permanently delete a file
- copy_file           - copy a file
- move_file           - move a file to a different parent folder
"""

from __future__ import annotations

import base64
from typing import Any, Dict, List, Optional

from googleapiclient.http import MediaIoBaseDownload
import io

from .client import GoogleDriveClient, get_auth_from_headers

# --------------------------------------------------------------------- #
# MIME-type → export format mapping for Google Workspace documents       #
# --------------------------------------------------------------------- #
_GOOGLE_APPS_EXPORT: Dict[str, str] = {
    "application/vnd.google-apps.document": "text/markdown",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
    "application/vnd.google-apps.drawing": "image/png",
    "application/vnd.google-apps.script": "application/json",
    "application/vnd.google-apps.form": "application/zip",
}

_DEFAULT_FILE_FIELDS = (
    "id, name, mimeType, size, modifiedTime, createdTime, "
    "parents, webViewLink, webContentLink, trashed, description"
)


# --------------------------------------------------------------------- #
# Tools                                                                   #
# --------------------------------------------------------------------- #


async def search_files(
    query: str,
    page_size: int = 10,
    page_token: Optional[str] = None,
    include_trashed: bool = False,
) -> Dict[str, Any]:
    """
    Search for files in Google Drive using a full-text or metadata query.

    Args:
        query: Drive query string, e.g. ``"name contains 'report'"`` or
               simply a plain keyword that will be wrapped in a full-text
               ``fullText contains …`` expression automatically.
        page_size: Maximum number of results to return (1-100, default 10).
        page_token: Continuation token returned by a previous call to fetch
                    the next page of results.
        include_trashed: Whether to include files in the trash (default False).

    Returns:
        Dict with ``files`` list and optional ``next_page_token``.
    """
    auth = get_auth_from_headers()
    service = await GoogleDriveClient.build_service(auth)

    # Auto-wrap bare keywords as full-text search
    if "contains" not in query and "=" not in query and "!=" not in query:
        escaped = query.replace("\\", "\\\\").replace("'", "\\'")
        q = f"fullText contains '{escaped}'"
    else:
        q = query

    if not include_trashed:
        q = f"({q}) and trashed = false"

    params: Dict[str, Any] = {
        "q": q,
        "pageSize": min(max(page_size, 1), 100),
        "fields": f"nextPageToken, files({_DEFAULT_FILE_FIELDS})",
    }
    if page_token:
        params["pageToken"] = page_token

    result = service.files().list(**params).execute()

    return {
        "files": result.get("files", []),
        "next_page_token": result.get("nextPageToken"),
    }


async def list_files(
    folder_id: Optional[str] = None,
    page_size: int = 20,
    page_token: Optional[str] = None,
    order_by: str = "modifiedTime desc",
    include_trashed: bool = False,
) -> Dict[str, Any]:
    """
    List files in Google Drive, optionally scoped to a specific folder.

    Args:
        folder_id: ID of the parent folder. Omit to list files in the root /
                   "My Drive".
        page_size: Maximum number of results to return (1-100, default 20).
        page_token: Continuation token for pagination.
        order_by: Sorting order, e.g. ``"modifiedTime desc"`` (default) or
                  ``"name"``.
        include_trashed: Whether to include trashed files (default False).

    Returns:
        Dict with ``files`` list and optional ``next_page_token``.
    """
    auth = get_auth_from_headers()
    service = await GoogleDriveClient.build_service(auth)

    conditions: List[str] = []
    if folder_id:
        conditions.append(f"'{folder_id}' in parents")
    if not include_trashed:
        conditions.append("trashed = false")

    q = " and ".join(conditions) if conditions else None

    params: Dict[str, Any] = {
        "pageSize": min(max(page_size, 1), 100),
        "fields": f"nextPageToken, files({_DEFAULT_FILE_FIELDS})",
        "orderBy": order_by,
    }
    if q:
        params["q"] = q
    if page_token:
        params["pageToken"] = page_token

    result = service.files().list(**params).execute()

    return {
        "files": result.get("files", []),
        "next_page_token": result.get("nextPageToken"),
    }


async def get_file_metadata(file_id: str) -> Dict[str, Any]:
    """
    Get detailed metadata for a specific file or folder in Google Drive.

    Args:
        file_id: The ID of the file or folder.

    Returns:
        Dict containing file metadata fields.
    """
    auth = get_auth_from_headers()
    service = await GoogleDriveClient.build_service(auth)

    result = service.files().get(fileId=file_id, fields=_DEFAULT_FILE_FIELDS).execute()
    return result


async def read_file_content(file_id: str) -> Dict[str, Any]:
    """
    Read (download or export) the content of a file from Google Drive.

    Google Workspace documents (Docs, Sheets, Slides, …) are exported to a
    human-readable text format. The response shape depends on the file type:

    - Text files / Google Workspace exports:
        ``{"type": "text-plain", "text": "…", "mime_type": "…", "name": "…"}``
    - Image files (JPEG, PNG, GIF, …):
        ``{"type": "image", "base64": "…", "mime_type": "…", "name": "…"}``
    - All other binary files (PDF, video, zip, …):
        ``{"type": "file", "base64": "…", "mime_type": "…", "name": "…"}``

    Args:
        file_id: The ID of the file to read.
    """
    auth = get_auth_from_headers()
    service = await GoogleDriveClient.build_service(auth)

    # Fetch metadata first to check MIME type and name
    meta = service.files().get(fileId=file_id, fields="id, name, mimeType").execute()
    name = meta.get("name", "")
    mime_type: str = meta.get("mimeType", "application/octet-stream")

    # --- Google Workspace document: export to text ---
    if mime_type.startswith("application/vnd.google-apps"):
        export_mime = _GOOGLE_APPS_EXPORT.get(mime_type, "text/plain")
        response = (
            service.files().export(fileId=file_id, mimeType=export_mime).execute()
        )
        # export() returns bytes
        if isinstance(response, bytes):
            text = response.decode("utf-8", errors="replace")
        else:
            text = str(response)
        return {
            "type": "text-plain",
            "text": text,
            "mime_type": export_mime,
            "name": name,
        }

    # --- Regular file: download ---
    request = service.files().get_media(fileId=file_id)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()

    raw_bytes = buffer.getvalue()

    if mime_type.startswith("text/") or mime_type == "application/json":
        return {
            "type": "text-plain",
            "text": raw_bytes.decode("utf-8", errors="replace"),
            "mime_type": mime_type,
            "name": name,
        }
    elif mime_type.startswith("image/"):
        return {
            "type": "image",
            "base64": base64.b64encode(raw_bytes).decode("ascii"),
            "mime_type": mime_type,
            "name": name,
        }
    else:
        return {
            "type": "file",
            "base64": base64.b64encode(raw_bytes).decode("ascii"),
            "mime_type": mime_type,
            "name": name,
        }


async def delete_file(file_id: str) -> Dict[str, Any]:
    """
    Permanently delete a file or folder from Google Drive.

    Args:
        file_id: The ID of the file or folder to delete.

    Returns:
        Dict confirming deletion with ``file_id`` and ``status``.
    """
    auth = get_auth_from_headers()
    service = await GoogleDriveClient.build_service(auth)

    service.files().delete(fileId=file_id).execute()
    return {"file_id": file_id, "status": "deleted"}


async def copy_file(
    file_id: str,
    new_name: Optional[str] = None,
    parent_folder_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Copy a file to the same or a different folder.

    Args:
        file_id: The ID of the file to copy.
        new_name: Name for the copy. Defaults to "Copy of <original name>".
        parent_folder_id: Destination folder ID. Defaults to the same parent
                          as the original.

    Returns:
        Dict with the metadata of the newly created copy.
    """
    auth = get_auth_from_headers()
    service = await GoogleDriveClient.build_service(auth)

    body: Dict[str, Any] = {}
    if new_name:
        body["name"] = new_name
    if parent_folder_id:
        body["parents"] = [parent_folder_id]

    result = (
        service.files()
        .copy(fileId=file_id, body=body, fields=_DEFAULT_FILE_FIELDS)
        .execute()
    )
    return result


async def move_file(
    file_id: str,
    new_parent_folder_id: str,
) -> Dict[str, Any]:
    """
    Move a file to a different folder in Google Drive.

    Args:
        file_id: The ID of the file to move.
        new_parent_folder_id: The ID of the destination folder.

    Returns:
        Dict with the updated file metadata.
    """
    auth = get_auth_from_headers()
    service = await GoogleDriveClient.build_service(auth)

    # Retrieve current parents
    meta = service.files().get(fileId=file_id, fields="parents").execute()
    previous_parents = ",".join(meta.get("parents", []))

    result = (
        service.files()
        .update(
            fileId=file_id,
            addParents=new_parent_folder_id,
            removeParents=previous_parents,
            fields=_DEFAULT_FILE_FIELDS,
        )
        .execute()
    )
    return result
