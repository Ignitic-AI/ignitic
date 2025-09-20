from datetime import datetime
from models.credential import Credential
from core.auth import AuthProvider
from core.backend_client import BackendClient


class CredentialService:
    def __init__(self, auth: AuthProvider):
        self._backend_client = BackendClient(auth)

    @staticmethod
    def adapt_from_backend(data: dict) -> Credential:
        """
        Adapt a credential dictionary from the backend API to a Credential model.

        Args:
            data (dict): The credential data from the backend API.
        Returns:
            Credential: The adapted Credential model.
        """
        if not data.get("secrets") or not isinstance(data["secrets"], list):
            raise ValueError(
                "Invalid backend data: 'secrets' field is required and must be a list"
            )

        secrets = data["secrets"]
        if not secrets:
            raise ValueError("Invalid backend data: 'secrets' list cannot be empty")

        # Extract basic information from the first secret
        first_secret = secrets[0]
        app_name = first_secret.get("app", "unknown")
        user_id = first_secret.get("created_by", "")

        # Convert secrets array to data dictionary
        credential_data = {}
        latest_timestamp = None

        for secret in secrets:
            name = secret.get("name")
            value = secret.get("value")

            if name and value is not None:
                credential_data[name] = value

            # Track the latest updated_at timestamp
            updated_at_str = secret.get("updated_at")
            if updated_at_str:
                try:
                    updated_at = datetime.fromisoformat(
                        updated_at_str.replace("Z", "+00:00")
                    )
                    if latest_timestamp is None or updated_at > latest_timestamp:
                        latest_timestamp = updated_at
                except ValueError:
                    # If datetime parsing fails, skip this timestamp
                    pass

        # Use current time if no valid timestamp found
        if latest_timestamp is None:
            latest_timestamp = datetime.now()

        return Credential(
            name=app_name,
            u_id=user_id,
            org_id=None,  # Backend doesn't provide org_id in the current format
            data=credential_data,
            updatedAt=latest_timestamp,
        )

    async def get_credential(self, name: str) -> Credential:
        """
        Retrieve a credential by name for the current user or their organization.

        Args:
            name (str): The name of the credential to retrieve.
        Returns:
            Credential: The credential object if found.
        Raises:
            ValueError: If the credential is not found or access is denied.
        """

        res = await self._backend_client.get(f"secrets/{name}/values")
        return CredentialService.adapt_from_backend(res)
