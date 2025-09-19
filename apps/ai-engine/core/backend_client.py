import os
import json
from typing import Any, Optional, Dict
from fastapi import HTTPException
import httpx
from core.auth import AuthProvider

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL")


class BackendClient:
    def __init__(self, auth: AuthProvider):
        if not BACKEND_BASE_URL:
            raise ValueError("BACKEND_BASE_URL environment variable is not set")
        self._base_url = BACKEND_BASE_URL
        self._token = auth.get_token()

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
        headers = {"Authorization": f"Bearer {self._token}"}
        async with httpx.AsyncClient() as client:
            response = await client.get(full_url, headers=headers, *args, **kwargs)
        return await self._handle_response(response)

    async def post(self, endpoint: str, *args, **kwargs) -> Any:
        full_url = self._build_url(endpoint)
        headers = {"Authorization": f"Bearer {self._token}"}
        async with httpx.AsyncClient() as client:
            response = await client.post(full_url, headers=headers, *args, **kwargs)
        return await self._handle_response(response)

    async def put(self, endpoint: str, *args, **kwargs) -> Any:
        full_url = self._build_url(endpoint)
        headers = {"Authorization": f"Bearer {self._token}"}
        async with httpx.AsyncClient() as client:
            response = await client.put(full_url, headers=headers, *args, **kwargs)
        return await self._handle_response(response)

    async def delete(self, endpoint: str, *args, **kwargs) -> Any:
        full_url = self._build_url(endpoint)
        headers = {"Authorization": f"Bearer {self._token}"}
        async with httpx.AsyncClient() as client:
            response = await client.delete(full_url, headers=headers, *args, **kwargs)
        return await self._handle_response(response)

    async def patch(self, endpoint: str, *args, **kwargs) -> Any:
        full_url = self._build_url(endpoint)
        headers = {"Authorization": f"Bearer {self._token}"}
        async with httpx.AsyncClient() as client:
            response = await client.patch(full_url, headers=headers, *args, **kwargs)
        return await self._handle_response(response)
