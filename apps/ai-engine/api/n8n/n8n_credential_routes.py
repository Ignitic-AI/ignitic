from fastapi import APIRouter, HTTPException
from models.automations.n8n.n8n_credential import N8NSMTPCredential
from services.n8n.n8n_credential_service import encrypt_password

router = APIRouter(prefix="/credential/n8n")


@router.post("/smtp")
async def create_smtp_cred(credential: N8NSMTPCredential):
    try:
        existing = N8NSMTPCredential.find_one(N8NSMTPCredential.user == credential.user)
        if existing:
            raise HTTPException(
                status_code=400, detail="SMTP credential for this user already exists."
            )
        else:
            credential.password = encrypt_password(credential.password)
            await credential.insert()
            return {
                "message": "SMTP credential created successfully.",
                "id": str(credential.id),
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
