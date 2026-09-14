import json
import requests

CREDENTIALS_FILE = "credentials.json"
OUTPUT_FILE = "n8n_credentials_schema.json"
API_URL = "http://localhost:5678/api/v1/credentials/schema/"
API_KEY = "REDACTED"

headers = {
    "accept": "application/json",
    "X-N8N-API-KEY": API_KEY
}

def main():
    with open(CREDENTIALS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    cred_names = data.get("credentials", [])
    schemas = {}

    for cred in cred_names:
        cred_lc = cred[0].lower() + cred[1:]
        url = API_URL + cred_lc
        try:
            resp = requests.get(url, headers=headers)
            resp.raise_for_status()
            schemas[cred_lc] = resp.json()
            print(f"Fetched schema for {cred_lc}")
        except Exception as e:
            print(f"Failed to fetch schema for {cred_lc}: {e}")

    # Add schemas to the JSON file
    data["schemas"] = schemas
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

if __name__ == "__main__":
    main()