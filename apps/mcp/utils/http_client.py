import httpx
from typing import Optional, Dict, Any
from urllib.parse import urljoin
from utils.exception_handling import (
    BadRequestError,
    UnauthorizedError,
    NotFoundError,
    ServerError,
    UnknownHTTPError,
)


class BaseHTTPClient:
    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=timeout, follow_redirects=True)

    async def get(
        self,
        endpoint: str,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
    ) -> Dict[Any, Any]:
        url = urljoin(self.base_url, endpoint)
        response = await self.client.get(url, params=params, headers=headers)
        response.raise_for_status()
        return response.json()

    async def post(
        self, endpoint: str, data: Optional[Dict] = None, headers: Optional[Dict] = None
    ) -> Dict[Any, Any]:
        url = urljoin(self.base_url, endpoint)
        response = await self.client.post(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()

    async def put(
        self, endpoint: str, data: Optional[Dict] = None, headers: Optional[Dict] = None
    ) -> Dict[Any, Any]:
        url = urljoin(self.base_url, endpoint)
        response = await self.client.put(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()

    async def patch(
        self, endpoint: str, data: Optional[Dict] = None, headers: Optional[Dict] = None
    ) -> Dict[Any, Any]:
        url = urljoin(self.base_url, endpoint)
        response = await self.client.patch(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()

    async def delete(
        self, endpoint: str, headers: Optional[Dict] = None
    ) -> Optional[Dict[Any, Any]]:
        url = urljoin(self.base_url, endpoint)
        response = await self.client.delete(url, headers=headers)
        response.raise_for_status()
        return response.json() if response.content else None

    async def close(self):
        await self.client.aclose()


def handle_http_status_error(exc: httpx.HTTPStatusError):
    status = exc.response.status_code

    if status == 400:
        raise BadRequestError(f"Bad Request: {exc.response.text}") from exc
    elif status == 401:
        raise UnauthorizedError("Unauthorized. Check your API key.") from exc
    elif status == 404:
        raise NotFoundError(f"Resource not found at {exc.request.url}") from exc
    elif 500 <= status < 600:
        raise ServerError(f"Server error {status}: {exc.response.text}") from exc
    else:
        raise UnknownHTTPError(
            f"Unexpected error {status}: {exc.response.text}"
        ) from exc
