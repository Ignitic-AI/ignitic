from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from models.automations.n8n.n8n_credential import N8NCredential
from services.n8n.n8n_credential_service import encrypt_password
from core.auth import get_auth, AuthProvider
from services.n8n.n8n_credential_service import N8NCredentialService
from models.user import User

router = APIRouter(prefix="/credential/n8n")


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
        user = auth.get_user()
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


@router.get("/{id}")
async def get_credential(id: str, auth: AuthProvider = Depends(get_auth)):
    """
    Retrieve a specific n8n credential by its ID.

    Args:
        id (str): The ID of the n8n credential to retrieve.
        user (User): The current authenticated user.

    Returns:
        N8NCredential: The requested n8n credential in JSON format.

    Raises:
        HTTPException: If the credential is not found, returns a 404 status code.
    """
    try:
        user = auth.get_user()
        credential = await N8NCredential.find_one(
            N8NCredential.id == id
            and (N8NCredential.u_id == user.id or N8NCredential.org_id == user.org_id),
            with_children=True,
        )
        if not credential:
            raise HTTPException(status_code=404, detail="Credential not found")
        return {
            **credential.model_dump(),
            "id": str(credential.id),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{credential_id}")
async def delete_credential(credential_id: str, auth: AuthProvider = Depends(get_auth)):
    """
    Delete an SMTP credential by its ID for the authenticated user or organization.

    Args:
        credential_id (str): The ID of the SMTP credential to delete.
        user (User): The current authenticated user (injected via dependency).

    Returns:
        dict: Success message if the credential is deleted.

    Raises:
        HTTPException:
            - 404 if the credential is not found.
            - 500 if deletion from n8n or database fails.
            - 400 for any other exceptions encountered during deletion.
    """
    try:
        user = auth.get_user()
        credential = await N8NCredential.find_one(
            N8NCredential.id == credential_id
            and (
                N8NCredential.u_id == user.id
                or N8NCredential.org_id == user.org_id
            )
        )
        if not credential:
            raise HTTPException(status_code=404, detail="Credential not found")

        success = await N8NCredentialService(auth=auth).delete_credential_from_n8n(credential)
        if not success:
            raise HTTPException(
                status_code=500, detail="Failed to delete credential from n8n"
            )

        result = await credential.delete()
        if not result:
            raise HTTPException(
                status_code=500, detail="Failed to delete credential from database"
            )

        return {"message": "Credential deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
