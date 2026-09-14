import os
import json
import glob


def extract_node_names():
    # Get the path to the nodes directory
    nodes_dir = os.path.join("..", "nodes")

    # Find all .node.ts files recursively
    pattern = os.path.join(nodes_dir, "**", "*.node.ts")
    node_files = glob.glob(pattern, recursive=True)

    # Extract node names
    node_names = []
    for file_path in node_files:
        # Get the filename without path
        filename = os.path.basename(file_path)

        # Remove .node.ts extension and convert first letter to lowercase
        if filename.endswith(".node.ts"):
            node_name = filename[:-8]  # Remove '.node.ts'
            # Convert first letter to lowercase
            if node_name:
                node_name = node_name[0].lower() + node_name[1:]
                node_names.append(node_name)

    # Sort the names for consistency
    node_names.sort()

    # Remove duplicates while preserving order
    unique_node_names = []
    seen = set()
    for name in node_names:
        if name not in seen:
            unique_node_names.append(name)
            seen.add(name)

    print(f"Found {len(unique_node_names)} unique node names")

    # Update nodes.json
    nodes_json_path = "nodes.json"

    # Read existing data
    try:
        with open(nodes_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        data = {}

    # Update with node names
    data["nodes"] = unique_node_names

    # Write back to file
    with open(nodes_json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

    print(f"Updated {nodes_json_path} with {len(unique_node_names)} node names")

    # Print first few examples
    print("\nFirst 10 node names:")
    for i, name in enumerate(unique_node_names[:10]):
        print(f"  {i + 1}. {name}")

    return unique_node_names


if __name__ == "__main__":
    extract_node_names()
