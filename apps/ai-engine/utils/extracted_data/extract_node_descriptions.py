import os
import json
import re
import glob
from typing import Dict, Any, Optional, List


def get_base_node_name(node_name: str) -> str:
    """Extract base node name from versioned name (e.g., 'emailSendV2' -> 'emailSend')"""
    # Remove version suffix like V1, V2, etc.
    match = re.match(r"(.+?)V\d+$", node_name)
    if match:
        return match.group(1)
    return node_name


def get_version_number(node_name: str) -> int:
    """Extract version number from versioned node name (e.g., 'emailSendV2' -> 2)"""
    match = re.search(r"V(\d+)$", node_name)
    if match:
        return int(match.group(1))
    return 0  # Base version


def group_nodes_by_base_name(node_names: List[str]) -> Dict[str, List[str]]:
    """Group node names by their base name, including versioned variants"""
    groups = {}

    for node_name in node_names:
        base_name = get_base_node_name(node_name)
        if base_name not in groups:
            groups[base_name] = []
        groups[base_name].append(node_name)

    return groups


def get_latest_version_node(node_variants: List[str]) -> str:
    """Get the latest version node from a list of node variants"""
    # Sort by version number, latest first
    sorted_variants = sorted(node_variants, key=get_version_number, reverse=True)
    return sorted_variants[0]


def find_node_file(node_name: str, nodes_dir: str) -> Optional[str]:
    """Find the .node.ts file for a given node name."""
    # Convert node name back to PascalCase for filename matching
    # e.g., 'brevo' -> 'Brevo', 'emailSendV2' -> 'EmailSendV2'
    pascal_case = node_name[0].upper() + node_name[1:]

    # Handle special cases where the conversion might not be straightforward
    search_patterns = [
        f"**/{pascal_case}.node.ts",
        f"**/{pascal_case}*.node.ts",
        f"**/*{pascal_case}*.node.ts",
    ]

    for pattern in search_patterns:
        full_pattern = os.path.join(nodes_dir, pattern)
        matches = glob.glob(full_pattern, recursive=True)
        if matches:
            return matches[0]

    return None


def find_version_description_file(node_file_path: str) -> Optional[str]:
    """Find the versionDescription file for nodes that import it."""
    node_dir = os.path.dirname(node_file_path)
    actions_dir = os.path.join(node_dir, "actions")

    # Look for versionDescription file
    version_desc_files = [
        os.path.join(actions_dir, "versionDescription.ts"),
        os.path.join(actions_dir, "versionDescription.js"),
        os.path.join(node_dir, "versionDescription.ts"),
        os.path.join(node_dir, "versionDescription.js"),
    ]

    for file_path in version_desc_files:
        if os.path.exists(file_path):
            return file_path

    return None


def extract_constructor_description(content: str) -> Optional[Dict[str, Any]]:
    """Extract description object from constructor pattern."""
    # Look for this.description assignment in the entire file content
    desc_pattern = r"this\.description\s*=\s*\{"
    desc_match = re.search(desc_pattern, content)

    if not desc_match:
        return None

    # Find the start of the object
    start_pos = desc_match.end() - 1  # Position of the opening brace

    # Find the matching closing brace using proper brace counting
    brace_count = 0
    pos = start_pos
    in_string = False
    escape_next = False
    string_char = None

    while pos < len(content):
        char = content[pos]

        # Handle string literals to avoid counting braces inside strings
        if escape_next:
            escape_next = False
        elif char == "\\" and in_string:
            escape_next = True
        elif char in ('"', "'", "`") and not in_string:
            in_string = True
            string_char = char
        elif char == string_char and in_string and not escape_next:
            in_string = False
            string_char = None
        elif not in_string:
            if char == "{":
                brace_count += 1
            elif char == "}":
                brace_count -= 1
                if brace_count == 0:
                    break

        pos += 1

    if brace_count != 0:
        return None

    # Extract the object content (without the outer braces)
    object_content = content[start_pos + 1 : pos]

    return parse_description_object(object_content)


def parse_description_object(object_content: str) -> Dict[str, Any]:
    """Parse the description object content and extract key fields."""
    description_data = {}

    # Extract displayName
    display_name_match = re.search(
        r'displayName:\s*[\'"]([^\'"]*)[\'"]', object_content
    )
    if display_name_match:
        description_data["displayName"] = display_name_match.group(1)

    # Extract name
    name_match = re.search(r'(?<!display)name:\s*[\'"]([^\'"]*)[\'"]', object_content)
    if name_match:
        description_data["name"] = name_match.group(1)

    # Extract icon
    icon_match = re.search(r'icon:\s*[\'"]([^\'"]*)[\'"]', object_content)
    if icon_match:
        description_data["icon"] = icon_match.group(1)

    # Extract version (could be number or array)
    version_match = re.search(r"version:\s*(\[.*?\]|\d+)", object_content, re.DOTALL)
    if version_match:
        version_str = version_match.group(1)
        if version_str.startswith("["):
            # It's an array, try to parse it
            try:
                # Simple array parsing for version arrays like [2, 2.1]
                version_content = version_str.strip("[]")
                versions = [float(v.strip()) for v in version_content.split(",")]
                description_data["version"] = versions
            except Exception:
                description_data["version"] = version_str
        else:
            description_data["version"] = int(version_str)

    # Extract description (handle multiline strings and template literals)
    desc_patterns = [
        r'(?<!display)description:\s*[\'"]([^\'"]*)[\'"]',  # Single line string
        r"(?<!display)description:\s*'([^']*(?:\n[^']*)*)'",  # Multiline single quotes
        r'(?<!display)description:\s*"([^"]*(?:\n[^"]*)*)"',  # Multiline double quotes
        r"(?<!display)description:\s*`([^`]*(?:\n[^`]*)*)`",  # Template literal
    ]

    for pattern in desc_patterns:
        desc_match = re.search(pattern, object_content, re.DOTALL)
        if desc_match:
            description_data["description"] = desc_match.group(1).strip()
            break

    # Extract group (array)
    group_match = re.search(r"group:\s*\[(.*?)\]", object_content, re.DOTALL)
    if group_match:
        group_content = group_match.group(1)
        groups = re.findall(r'[\'"]([^\'"]*)[\'"]', group_content)
        description_data["group"] = groups

    # Extract subtitle
    subtitle_match = re.search(r'subtitle:\s*[\'"]([^\'"]*)[\'"]', object_content)
    if subtitle_match:
        description_data["subtitle"] = subtitle_match.group(1)

    # Extract defaults
    defaults_match = re.search(r"defaults:\s*\{([^}]*)\}", object_content)
    if defaults_match:
        defaults_content = defaults_match.group(1)
        defaults_data = {}

        # Extract name from defaults
        defaults_name_match = re.search(
            r'name:\s*[\'"]([^\'"]*)[\'"]', defaults_content
        )
        if defaults_name_match:
            defaults_data["name"] = defaults_name_match.group(1)

        # Extract color from defaults
        defaults_color_match = re.search(
            r'color:\s*[\'"]([^\'"]*)[\'"]', defaults_content
        )
        if defaults_color_match:
            defaults_data["color"] = defaults_color_match.group(1)

        if defaults_data:
            description_data["defaults"] = defaults_data

    # Extract usableAsTool
    tool_match = re.search(r"usableAsTool:\s*(true|false)", object_content)
    if tool_match:
        description_data["usableAsTool"] = tool_match.group(1) == "true"

    # Extract credentials (simplified)
    creds_match = re.search(r"credentials:\s*\[(.*?)\]", object_content, re.DOTALL)
    if creds_match:
        creds_content = creds_match.group(1)
        # Look for credential objects
        cred_objects = re.findall(r"\{([^}]*)\}", creds_content)
        credentials = []
        for cred_obj in cred_objects:
            cred_name_match = re.search(r'name:\s*[\'"]([^\'"]*)[\'"]', cred_obj)
            cred_required_match = re.search(r"required:\s*(true|false)", cred_obj)
            if cred_name_match:
                cred_data = {"name": cred_name_match.group(1)}
                if cred_required_match:
                    cred_data["required"] = cred_required_match.group(1) == "true"
                credentials.append(cred_data)
        if credentials:
            description_data["credentials"] = credentials

    return description_data


def extract_description_object(file_path: str) -> Optional[Dict[str, Any]]:
    """Extract the description or versionDescription object from a .node.ts file."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Method 1: Look for direct description/versionDescription assignment
        patterns = [
            r"versionDescription:\s*INodeTypeDescription\s*=\s*\{",
            r"description:\s*INodeTypeDescription\s*=\s*\{",
        ]

        for pattern in patterns:
            match = re.search(pattern, content)
            if match:
                # Find the start of the object
                start_pos = match.end() - 1  # Position of the opening brace

                # Find the matching closing brace
                brace_count = 0
                pos = start_pos
                while pos < len(content):
                    if content[pos] == "{":
                        brace_count += 1
                    elif content[pos] == "}":
                        brace_count -= 1
                        if brace_count == 0:
                            break
                    pos += 1

                if brace_count == 0:
                    # Extract the object content (without the outer braces)
                    object_content = content[start_pos + 1 : pos]
                    return parse_description_object(object_content)

        # Method 2: Check if this file imports versionDescription
        if (
            "import { versionDescription }" in content
            or "import {versionDescription}" in content
        ):
            version_desc_file = find_version_description_file(file_path)
            if version_desc_file:
                return extract_description_object(version_desc_file)

        # Method 3: Look for constructor-based description
        constructor_desc = extract_constructor_description(content)
        if constructor_desc:
            return constructor_desc

        print(f"No description pattern found in {file_path}")
        return None

    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
        return None


def main():
    # Load node names
    with open("nodes.json", "r", encoding="utf-8") as f:
        nodes_data = json.load(f)

    node_names = nodes_data["nodes"]
    nodes_dir = os.path.join("..", "nodes")

    # Group nodes by base name to handle versioning
    node_groups = group_nodes_by_base_name(node_names)

    nodes_descriptions = {}
    processed = 0
    failed = 0

    print(
        f"Processing {len(node_groups)} unique nodes (including versioned variants)..."
    )

    for base_name, variants in node_groups.items():
        print(f"Processing: {base_name} (variants: {variants})")

        # Get the latest version node
        latest_node = get_latest_version_node(variants)
        print(f"  Using latest version: {latest_node}")

        # Find the corresponding .node.ts file
        file_path = find_node_file(latest_node, nodes_dir)

        if not file_path:
            print(f"  File not found for {latest_node}")
            failed += 1
            continue

        # Extract description object
        description = extract_description_object(file_path)

        if description:
            # Store under the base name (without version)
            nodes_descriptions[base_name] = description
            processed += 1
            print("  ✓ Extracted description")
        else:
            failed += 1
            print("  ✗ Failed to extract description")

    # Save to nodes_data.json
    with open("nodes_data.json", "w", encoding="utf-8") as f:
        json.dump(nodes_descriptions, f, indent=4)

    print("\nCompleted!")
    print(f"Successfully processed: {processed}")
    print(f"Failed: {failed}")
    print("Results saved to nodes_data.json")


if __name__ == "__main__":
    main()
