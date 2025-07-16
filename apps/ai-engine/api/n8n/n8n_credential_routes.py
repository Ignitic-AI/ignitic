from fastapi import APIRouter, Depends, HTTPException
from models.automations.n8n.n8n_credential import N8NSMTPCredential
from services.n8n.n8n_credential_service import encrypt_password
from core.auth import get_current_user
from services.n8n.n8n_credential_service import register_credential_on_n8n

router = APIRouter(prefix="/credential/n8n")


@router.post("/smtp")
async def create_smtp_cred(
    credential: N8NSMTPCredential, user=Depends(get_current_user)
):
    try:
        credential.u_id = user.get("user_id")
        credential.org_id = user.get("org_id")
        existing = await N8NSMTPCredential.find_one(N8NSMTPCredential.user == credential.user)

        if existing:
            raise HTTPException(
                status_code=400, detail="SMTP credential for this user already exists."
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
