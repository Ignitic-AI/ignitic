from typing import Annotated, Optional
from pydantic import Field, model_validator
from beanie import Document, PydanticObjectId



class N8NCredential(Document):
    type: str
    n8n_id: Optional[str]
    u_id: Optional[PydanticObjectId]
    org_id: Optional[PydanticObjectId]

    @model_validator(mode="before")
    def uid_or_orgid_must_exist(cls):
        if cls.u_id is None and cls.org_id is None:
            raise ValueError("Either 'u_id' or 'org_id' must be provided.")
        return cls
    
    class Settings:
        name = "n8n_credentials"


class N8NSMTPCredential(N8NCredential):
    type: str = 'smtp'
    user: Annotated[str, "The username of SMTP server e.g. jondoe@example.com"]
    password: str
    host: Annotated[
        str, "The hostname or ip address of SMTP server e.g. smtp.gmail.com"
    ]
    port: int = Field(default=465)
    secure: bool = Field(default=False)
    disableStartTls: bool = Field(default=False)
    hostName: Optional[str]


    
