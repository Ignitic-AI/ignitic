import os
import json
from typing import Any
from fastapi import HTTPException
import httpx
from dotenv import load_dotenv

load_dotenv()

N8N_SERVER_URL = os.getenv("N8N_SERVER_URL")
N8N_API_KEY = os.getenv("N8N_API_KEY")

N8N_REQUEST_HEADERS = {
    "Content-Type": "application/json",
    "X-N8N-API-KEY": N8N_API_KEY,
    "accept": "application/json",
}

class N8NClient:
    def __init__(self):
        if not N8N_SERVER_URL:
            raise ValueError("N8N_SERVER_URL environment variable is not set")
        self._base_url = N8N_SERVER_URL
        self._headers = N8N_REQUEST_HEADERS

    def _build_url(self, endpoint: str) -> str:
        endpoint = endpoint.lstrip("/")
        base_url = self._base_url.rstrip("/") + "/"
        return base_url + endpoint

    async def _handle_response(self, response: httpx.Response) -> Any:
        try:
            status_code = response.status_code

            if 200 <= status_code < 300:
                try:
                    return response.json()
                except (json.JSONDecodeError, ValueError):
                    return response.text

            elif 400 <= status_code < 500:
                error_detail = "Client error"
                try:
                    error_data = response.json()
                    error_detail = error_data.get(
                        "detail", error_data.get("message", str(error_data))
                    )
                except (json.JSONDecodeError, ValueError, Exception):
                    error_detail = response.text or f"HTTP {status_code}"
                raise HTTPException(status_code=status_code, detail=error_detail)

            elif status_code >= 500:
                error_detail = "Backend server error"
                try:
                    error_data = response.json()
                    error_detail = error_data.get(
                        "detail", error_data.get("message", str(error_data))
                    )
                except (json.JSONDecodeError, ValueError, Exception):
                    error_detail = response.text or f"HTTP {status_code}"
                raise HTTPException(
                    status_code=502, detail=f"Backend API error: {error_detail}"
                )

            return response.text

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to process backend response: {str(e)}"
            )

    async def get(self, endpoint: str, *args, **kwargs) -> Any:
        full_url = self._build_url(endpoint)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                full_url, headers=self._headers, *args, **kwargs
            )
        return await self._handle_response(response)

    async def post(self, endpoint: str, *args, **kwargs) -> Any:
        full_url = self._build_url(endpoint)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                full_url, headers=self._headers, *args, **kwargs
            )
        return await self._handle_response(response)

    async def put(self, endpoint: str, *args, **kwargs) -> Any:
        full_url = self._build_url(endpoint)
        async with httpx.AsyncClient() as client:
            response = await client.put(
                full_url, headers=self._headers, *args, **kwargs
            )
        return await self._handle_response(response)

    async def delete(self, endpoint: str, *args, **kwargs) -> Any:
        full_url = self._build_url(endpoint)
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                full_url, headers=self._headers, *args, **kwargs
            )
        return await self._handle_response(response)

    async def patch(self, endpoint: str, *args, **kwargs) -> Any:
        full_url = self._build_url(endpoint)
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                full_url, headers=self._headers, *args, **kwargs
            )
        return await self._handle_response(response)
