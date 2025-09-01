import httpx
from typing import Optional, Dict, Any
from urllib.parse import urljoin


class BaseHTTPClient:
    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=timeout)

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

    async def delete(
        self, endpoint: str, headers: Optional[Dict] = None
    ) -> Optional[Dict[Any, Any]]:
        url = urljoin(self.base_url, endpoint)
        response = await self.client.delete(url, headers=headers)
        response.raise_for_status()
        return response.json() if response.content else None

    async def close(self):
        await self.client.aclose()
