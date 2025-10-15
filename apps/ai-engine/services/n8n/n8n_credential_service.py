from cryptography.fernet import Fernet
from dotenv import load_dotenv
from models.automations.n8n.n8n_credential import N8NCredential
from models.credential import Credential
from services.n8n.consts import N8N_SERVER_URL, N8N_REQUEST_HEADERS
from core.auth import AuthProvider
from core.n8n_client import N8NClient
import requests
import os

fernet = Fernet(str(os.getenv("PASS_ENCRYPTION_FERNET_KEY")))
load_dotenv()


def encrypt_password(password: str) -> str:
    return fernet.encrypt(password.encode()).decode()


def decrypt_password(token: str) -> str:
    return fernet.decrypt(token.encode()).decode()


class N8NCredentialService:
    def __init__(self, auth: AuthProvider) -> None:
        self._auth = auth
        self._n8n_client = N8NClient()

    def to_n8n_credential_schema(self, credential: Credential) -> dict:
        """
        Convert a Credential model to the schema required by n8n for credential registration.

        Args:
            credential (Credential): The Credential model to convert.
        Returns:
            dict: The converted credential schema for n8n.
        """
        if not credential.data:
            raise ValueError("Credential data missing")

        # Convert data with proper type casting
        converted_data = {}
        for k, v in credential.data.items():
            if k == "type":
                continue

            # Convert string representations to proper types
            if isinstance(v, str):
                # Convert string 'true'/'false' to boolean
                if v.lower() == "true":
                    converted_data[k] = True
                elif v.lower() == "false":
                    converted_data[k] = False
                # Convert numeric strings to integers
                elif v.isdigit():
                    converted_data[k] = int(v)
                else:
                    converted_data[k] = v
            else:
                converted_data[k] = v

        n8n_credential = {
            "name": f"{self._auth.get_user().email}-{credential.type}",
            "type": credential.type,
            "data": converted_data,
        }

        return n8n_credential

    async def register_credential_on_n8n(self, credential: Credential) -> N8NCredential:
        user = self._auth.get_user()
        request_data = self.to_n8n_credential_schema(credential)
        print(f"[N8N] Registering credential: {request_data}")
        response = await self._n8n_client.post(
            endpoint="credentials",
            json=request_data,
        )
        return N8NCredential(
            name=response["name"],
            type=credential.type,
            n8n_id=response["id"],
            u_id=user.id,
            org_id=user.org_id,
        )

    async def delete_credential_from_n8n(self, credential: N8NCredential) -> bool:
        try:
            response = await self._n8n_client.delete(
                f"credentials/{credential.n8n_id}",
            )
            return True if response.get("id") else False
        except Exception as e:
            raise ValueError(f"Error while deleting credential: {e}")
