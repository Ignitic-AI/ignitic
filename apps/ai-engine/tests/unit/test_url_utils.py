"""
Unit tests for utils/url.py – get_base_url helper.
"""

from utils.url import get_base_url


class TestGetBaseUrl:
    def test_http_with_path(self):
        assert get_base_url("http://example.com/some/path") == "http://example.com"

    def test_https_with_port(self):
        assert get_base_url("https://api.test:8080/v1/users") == "https://api.test:8080"

    def test_bare_domain(self):
        assert get_base_url("https://example.com") == "https://example.com"

    def test_with_query_string(self):
        assert get_base_url("https://example.com/path?key=val") == "https://example.com"

    def test_with_fragment(self):
        assert get_base_url("https://example.com/path#section") == "https://example.com"

    def test_trailing_slash(self):
        assert get_base_url("https://example.com/") == "https://example.com"
