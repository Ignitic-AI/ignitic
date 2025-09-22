from datetime import datetime
from typing import Annotated, Any, Dict, Optional
from pydantic import BaseModel, Field, model_validator
from beanie import Document, PydanticObjectId
from enum import Enum
from models.automations.workflow_credential import WorkflowCredential

class N8NCredentialType(str, Enum):
    smtp = "smtp"
    gmailOAuth2 = "gmailOAuth2"


class N8NNodeCredentialData(BaseModel):
    id: str
    name: str


class N8NCredential(WorkflowCredential):
    n8n_id: Optional[str] = None


# class N8NSMTPCredential(N8NCredential):
#     type: str = "smtp"
#     user: Annotated[str, "The username of SMTP server e.g. jondoe@example.com"]
#     password: str
#     host: Annotated[
#         str, "The hostname or ip address of SMTP server e.g. smtp.gmail.com"
#     ]
#     port: int = Field(default=465)
#     secure: bool = Field(default=False)
#     disableStartTls: bool = Field(default=False)
#     hostName: Optional[str] = None

#     def to_n8n_registration_schema(self) -> Dict[str, Any]:
#         data = {
#             "user": self.user,
#             "password": self.password,
#             "host": self.host,
#             "port": self.port,
#             "secure": self.secure,
#         }
#         if not self.secure:
#             data["disableStartTls"] = self.disableStartTls
#         if self.hostName:
#             data["hostName"] = self.hostName
#         return {
#             "type": self.type,
#             "name": self.name,
#             "data": data,
#         }
