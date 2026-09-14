from typing import Any, Dict, Optional

import httpx


async def hubspot_request(
    *,
    base_url: str,
    access_token: str,
    method: str,
    path: str,
    json_body: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None,
    timeout: float = 60.0,
) -> Any:
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.request(
            method.upper(),
            url,
            headers=headers,
            json=json_body,
            params=params,
        )
    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}
    if resp.is_success:
        return data
    raise RuntimeError(str({"status_code": resp.status_code, "error": data}))
