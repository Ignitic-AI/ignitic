"""
Google Drive MCP Server.

Exposes Google Drive operations as MCP tools and resources.

Tools
-----
Files
  • search_files       - full-text / metadata query across Drive
  • list_files         - list files; pass ``folder_id`` to scope to a folder
  • get_file_metadata  - fetch metadata for a single file
  • read_file_content  - download / export file content (text, image, or binary)
  • delete_file        - permanently delete a file
  • copy_file          - copy a file (optionally to a different folder)
  • move_file          - move a file to a different folder

Folders
  • create_folder      - create a new folder

Upload / Edit
  • create_text_file      - create a new text file with content
  • update_file_content   - overwrite content of an existing file

Permissions / Sharing
  • share_file            - grant a user access to a file
  • list_permissions      - list all permissions on a file
  • remove_permission     - revoke a specific permission
"""

from fastmcp import FastMCP
from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware
from servers.tools.google_drive import (
    copy_file,
    create_folder,
    create_text_file,
    delete_file,
    get_file_metadata,
    list_files,
    list_permissions,
    move_file,
    read_file_content,
    remove_permission,
    search_files,
    share_file,
    update_file_content,
)
# --------------------------------------------------------------------- #
# Server                                                                  #
# --------------------------------------------------------------------- #

app = FastMCP("Google Drive MCP", streamable_http_path="/")

# --------------------------------------------------------------------- #
# Tools - Files                                                           #
# --------------------------------------------------------------------- #

app.tool(
    search_files,
    meta={"ignitic_identifier": "tools.gdrive_agent.search_files"},
)

app.tool(
    list_files,
    meta={"ignitic_identifier": "tools.gdrive_agent.list_files"},
)

app.tool(
    get_file_metadata,
    meta={"ignitic_identifier": "tools.gdrive_agent.get_file_metadata"},
)

app.tool(
    read_file_content,
    meta={"ignitic_identifier": "tools.gdrive_agent.read_file_content"},
)

app.tool(
    delete_file,
    meta={"ignitic_identifier": "tools.gdrive_agent.delete_file"},
)

app.tool(
    copy_file,
    meta={"ignitic_identifier": "tools.gdrive_agent.copy_file"},
)

app.tool(
    move_file,
    meta={"ignitic_identifier": "tools.gdrive_agent.move_file"},
)

# --------------------------------------------------------------------- #
# Tools - Folders                                                         #
# --------------------------------------------------------------------- #

app.tool(
    create_folder,
    meta={"ignitic_identifier": "tools.gdrive_agent.create_folder"},
)

# --------------------------------------------------------------------- #
# Tools - Upload / Edit                                                   #
# --------------------------------------------------------------------- #

app.tool(
    create_text_file,
    meta={"ignitic_identifier": "tools.gdrive_agent.create_text_file"},
)

app.tool(
    update_file_content,
    meta={"ignitic_identifier": "tools.gdrive_agent.update_file_content"},
)

# --------------------------------------------------------------------- #
# Tools - Permissions / Sharing                                           #
# --------------------------------------------------------------------- #

app.tool(
    share_file,
    meta={"ignitic_identifier": "tools.gdrive_agent.share_file"},
)

app.tool(
    list_permissions,
    meta={"ignitic_identifier": "tools.gdrive_agent.list_permissions"},
)

app.tool(
    remove_permission,
    meta={"ignitic_identifier": "tools.gdrive_agent.remove_permission"},
)

# --------------------------------------------------------------------- #
# Middleware                                                               #
# --------------------------------------------------------------------- #

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())
