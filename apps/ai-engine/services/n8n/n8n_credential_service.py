from cryptography.fernet import Fernet
from dotenv import load_dotenv
from models.automations.n8n.n8n_credential import N8NCredential
from services.n8n.consts import N8N_SERVER_URL, N8N_REQUEST_HEADERS
import requests
import os

fernet = Fernet(os.getenv("PASS_ENCRYPTION_FERNET_KEY", ""))
load_dotenv()


def encrypt_password(password: str) -> str:
    return fernet.encrypt(password.encode()).decode()


def decrypt_password(token: str) -> str:
    return fernet.decrypt(token.encode()).decode()


async def register_credential_on_n8n(credential: N8NCredential) -> str:
    request_data = credential.to_n8n_registration_schema()
    print(f"[N8N] Registering credential: {request_data}")
    response = requests.post(
        url=f"{N8N_SERVER_URL}/credentials",
        json=request_data,
        headers=N8N_REQUEST_HEADERS,
    )
    print(f"[N8N] Registering credential: {response.status_code} - {response.text}")
    response.raise_for_status()
    return response.json().get("id")

async def delete_credential_from_n8n(credential: N8NCredential) -> bool:
    try:
        response = requests.delete(
            f"{N8N_SERVER_URL}/credentials/{credential.n8n_id}",
            headers=N8N_REQUEST_HEADERS,
        )
        print(f"[N8N] Deleting credential: {response.status_code} - {response.text}")
        return True if response.status_code == 200 else False
    except Exception as e:
        raise ValueError(f"Error while deleting credential: {e}")
