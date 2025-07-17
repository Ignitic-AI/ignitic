

from typing import Literal, Optional
from pydantic import BaseModel, EmailStr


class User(BaseModel):
    id: str
    name: Optional[str] = None
    email: EmailStr
    role: Literal["admin", "user"]
    org_id: Optional[str] = None