from cryptography.fernet import Fernet
from dotenv import load_dotenv
import os

load_dotenv()

fernet = Fernet(os.getenv("PASS_ENCRYPTION_FERNET_KEY", ""))

def encrypt_password(password: str) -> str:
    return fernet.encrypt(password.encode()).decode()

def decrypt_password(token: str) -> str:
    return fernet.decrypt(token.encode()).decode()