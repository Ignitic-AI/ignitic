from fastapi import APIRouter, Depends, HTTPException
from models.automations.n8n.n8n_credential import N8NSMTPCredential
from services.n8n.n8n_credential_service import encrypt_password
from core.auth import get_current_user
from services.n8n.n8n_credential_service import register_credential_on_n8n, delete_credential_from_n8n
from models.user import User
router = APIRouter(prefix="/credential/n8n")


@router.post("/smtp")
async def create_smtp_cred(
    credential: N8NSMTPCredential, user: User = Depends(get_current_user)
):
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
async def delete_credential(
    credential_id: str, user: User = Depends(get_current_user)
):
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
            raise HTTPException(status_code=500, detail="Failed to delete credential from n8n")

        result = await credential.delete()
        if not result:
            raise HTTPException(status_code=500, detail="Failed to delete credential from database")
        
        return {"message": "Credential deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
