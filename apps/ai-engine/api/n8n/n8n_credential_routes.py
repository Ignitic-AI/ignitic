from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from models.automations.n8n.n8n_credential import N8NSMTPCredential, N8NCredential
from services.n8n.n8n_credential_service import encrypt_password
from core.auth import get_user_auth
from services.n8n.n8n_credential_service import (
    register_credential_on_n8n,
    delete_credential_from_n8n,
)
from models.user import User

router = APIRouter(prefix="/credential/n8n")


@router.get("/")
async def get_credentials(
    limit: Optional[int] = 100, user: User = Depends(get_user_auth)
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
async def get_credential(id: str, user: User = Depends(get_user_auth)):
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


@router.post("/smtp")
async def create_smtp_cred(
    credential: N8NSMTPCredential, user: User = Depends(get_user_auth)
):
    """
    Create a new SMTP credential for the authenticated user or organization.

    Args:
        credential (N8NSMTPCredential): The SMTP credential data to be created.
        user (User): The current authenticated user (injected via dependency).

    Returns:
        dict: Success message and the created credential data.

    Raises:
        HTTPException:
            - 400 if a credential for this user or organization already exists.
            - 400 for any other exceptions encountered during creation.
    """
    try:
        credential.u_id = user.id
        credential.org_id = user.org_id
        existing = await N8NSMTPCredential.find_one(
            N8NSMTPCredential.user == credential.user
            or N8NSMTPCredential.org_id == credential.org_id
        )

        if existing:
            raise HTTPException(
                status_code=400,
                detail="SMTP credential for this user or organization already exists.",
            )
        else:
            credential.n8n_id = await register_credential_on_n8n(credential)
            credential.password = encrypt_password(credential.password)
            await credential.insert()
            return {
                "message": "SMTP credential created successfully.",
                "credential": {
                    **credential.model_dump(),
                    "id": str(credential.id),
                },
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{credential_id}")
async def delete_credential(credential_id: str, user: User = Depends(get_user_auth)):
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
        credential = await N8NSMTPCredential.find_one(
            N8NSMTPCredential.id == credential_id
            and (
                N8NSMTPCredential.u_id == user.id
                or N8NSMTPCredential.org_id == user.org_id
            )
        )
        if not credential:
            raise HTTPException(status_code=404, detail="Credential not found")

        success = await delete_credential_from_n8n(credential)
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
