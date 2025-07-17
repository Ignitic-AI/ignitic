from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from models.user import User
import jwt
import os

load_dotenv()

JWT_SECRET = os.getenv('JWT_SECRET', 'hello123')
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return User(
            id=payload.get("user_id"),
            email=payload.get("email"),
            name=payload.get("name"),
            role=payload.get("role", 'user'),
            org_id=payload.get("org_id")
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    