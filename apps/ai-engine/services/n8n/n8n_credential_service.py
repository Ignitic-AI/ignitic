from cryptography.fernet import Fernet
from dotenv import load_dotenv
from models.automations.n8n.n8n_credential import N8NCredential
import os
import requests

load_dotenv()

fernet = Fernet(os.getenv("PASS_ENCRYPTION_FERNET_KEY", ""))
N8N_SERVER_URL = os.getenv("N8N_SERVER_URL", "http://localhost:5678/api/v1")
N8N_API_KEY = os.getenv("N8N_API_KEY", "")

N8N_REQUEST_HEADERS = {
    "Content-Type": "application/json",
    "X-N8N-API-KEY": N8N_API_KEY,
    "accept": "application/json",
}


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
