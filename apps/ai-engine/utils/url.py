from urllib.parse import urlparse

def get_base_url(url: str) -> str:
    parsed = urlparse(url)
    # scheme://netloc (netloc includes host + optional port)
    return f"{parsed.scheme}://{parsed.netloc}"