from datetime import datetime
from typing import Annotated, Any, Dict, Optional
from pydantic import BaseModel, Field, model_validator
from beanie import Document, PydanticObjectId
from enum import Enum


class N8NCredentialType(str, Enum):
    smtp = "smtp"
    gmailOAuth2 = "gmailOAuth2"


class N8NNodeCredentialData(BaseModel):
    id: str
    name: str


class N8NCredential(Document):
    type: str
    n8n_id: Optional[str] = None
    u_id: Optional[str] = None
    org_id: Optional[str] = None
    name: str
    created_at: datetime = Field(
        default_factory=datetime.now, description="Creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.now, description="Last update timestamp"
    )

    class Settings:
        name = "n8n_credentials"
        is_root=True

    def to_n8n_registration_schema(self) -> Dict[str, Any]:
        """
        Convert the credential to a format suitable for n8n.
        This method should be overridden in subclasses to provide specific credential data.
        """
        raise NotImplementedError("Subclasses must implement this method.")


class N8NSMTPCredential(N8NCredential):
    type: str = "smtp"
    user: Annotated[str, "The username of SMTP server e.g. jondoe@example.com"]
    password: str
    host: Annotated[
        str, "The hostname or ip address of SMTP server e.g. smtp.gmail.com"
    ]
    port: int = Field(default=465)
    secure: bool = Field(default=False)
    disableStartTls: bool = Field(default=False)
    hostName: Optional[str] = None

    def to_n8n_registration_schema(self) -> Dict[str, Any]:
        data = {
            "user": self.user,
            "password": self.password,
            "host": self.host,
            "port": self.port,
            "secure": self.secure,
        }
        if not self.secure:
            data["disableStartTls"] = self.disableStartTls
        if self.hostName:
            data["hostName"] = self.hostName
        return {
            "type": self.type,
            "name": self.name,
            "data": data,
        }
