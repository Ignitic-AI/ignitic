from datetime import datetime
from models.credential import Credential
from core.auth import AuthProvider
from core.backend_client import BackendClient


class WorkflowCredentialService:
    def __init__(self, auth: AuthProvider):
        self._auth = auth

    
