from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from models.automations.n8n.n8n_credential import N8NCredential
from core.auth import get_auth, AuthProvider
from models.credential import Credential
from services.credential_service import CredentialService

router = APIRouter(prefix="/credential")


@router.get("/")
async def get_credentials(
    limit: Optional[int] = 100, auth: AuthProvider = Depends(get_auth)
):
    """
    Retrieve a list of n8n credentials for the authenticated user or organization.

    Args:
        limit (Optional[int], default=100): The maximum number of credentials to return.
        user (User): The current authenticated user.

    Returns:
        List[N8NCredential]: A list of n8n credentials in JSON format.

    Raises:
        HTTPException: If an error occurs during retrieval, returns a 400 status code with the error detail.
    """
    try:
        user = await auth.get_user()
        credentials = (
            await N8NCredential.find(
                (N8NCredential.u_id == user.id)
                or (N8NCredential.org_id == user.org_id),
                with_children=True,
            )
            .limit(limit)
            .to_list()
        )
        return [
            {
                **cred.model_dump(),
                "id": str(cred.id),
            }
            for cred in credentials
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{name}")
async def get_credential(name: str, auth: AuthProvider = Depends(get_auth)) -> Credential:
    """
    Retrieve a specific credential by its name.

    Args:
        name (str): The name of the credential to retrieve.
        user (User): The current authenticated user.

    Returns:
       Credential: The requested credential in JSON format.

    Raises:
        HTTPException: If the credential is not found, returns a 404 status code.
    """
    try:
        return await CredentialService(auth).get_credential(name=name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


