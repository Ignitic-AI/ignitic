from core.auth import AuthProvider
from core.backend_client import BackendClient
from models.organization import Organization
from loguru import logger


class OrganizationService:
    def __init__(self, auth: AuthProvider):
        self._backend_client = BackendClient(auth)

    @staticmethod
    def adapt_from_backend(data: dict) -> Organization:
        """
        Parse the /organizations/{org_id} response into an Organization model.

        Args:
            data: Raw response dict from the backend API.
        Returns:
            Organization model instance.
        """
        org = data.get("organization", data)
        user_role = data.get("user_role")
        return Organization(
            id=org["id"],
            name=org["name"],
            description=org.get("description"),
            employee_count=org.get("employee_count"),
            ecommerce_domain=org.get("ecommerce_domain"),
            industry=org.get("industry"),
            company_size=org.get("company_size"),
            website=org.get("website"),
            country=org.get("country"),
            city=org.get("city"),
            address=org.get("address"),
            phone_number=org.get("phone_number"),
            is_active=org.get("is_active", True),
            subscription_plan=org.get("subscription_plan"),
            created_at=org.get("created_at"),
            updated_at=org.get("updated_at"),
            user_role=user_role,
        )

    async def get_organization(self, org_id: str) -> Organization:
        """
        Fetch organization details by ID.

        Args:
            org_id: The organization's unique identifier.
        Returns:
            Organization model instance.
        """
        res = await self._backend_client.get(f"organizations/{org_id}")
        org = OrganizationService.adapt_from_backend(res)
        logger.info(f"🏢 Fetched organization: {org.name} ({org_id})")
        return org
