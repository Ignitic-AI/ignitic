import os
from dotenv import load_dotenv

load_dotenv()


N8N_SERVER_URL = os.getenv("N8N_SERVER_URL", "http://localhost:5678/api/v1")
N8N_API_KEY = os.getenv("N8N_API_KEY", "")

N8N_REQUEST_HEADERS = {
    "Content-Type": "application/json",
    "X-N8N-API-KEY": N8N_API_KEY,
    "accept": "application/json",
}