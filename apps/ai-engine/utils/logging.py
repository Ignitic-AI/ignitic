import json
from langchain_core.load import dumpd

def print_json(data):
    serializable_data = dumpd(data)
    print(json.dumps(serializable_data, indent=2))

def dump_json_to_file(data, file_path):
    serializable_data = dumpd(data)
    with open(file_path, 'w') as f:
        json.dump(serializable_data, f, indent=2)
