from __future__ import annotations

import html
import ipaddress
import re
from urllib.parse import parse_qs, unquote, urlparse

import httpx


class WebTools:
    """不依赖 API Key 的轻量公开网页检索工具。"""

    def __init__(self, *, timeout: float = 15.0, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": "VELA/2.5 (+https://github.com/FlightCatcher/VELA)"},
        )

    def web_search(self, query: str, limit: int = 5) -> dict[str, object]:
        clean_query = query.strip()
        if not clean_query:
            raise ValueError("Search query cannot be empty.")
        if not 1 <= limit <= 10:
            raise ValueError("limit must be between 1 and 10.")
        response = self._client.get("https://html.duckduckgo.com/html/", params={"q": clean_query})
        response.raise_for_status()
        results: list[dict[str, str]] = []
        pattern = re.compile(
            r'<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
            re.IGNORECASE | re.DOTALL,
        )
        for href, title in pattern.findall(response.text):
            parsed = urlparse(html.unescape(href))
            redirect_target = parse_qs(parsed.query).get("uddg", [""])[0]
            url = unquote(redirect_target) if redirect_target else html.unescape(href)
            clean_title = re.sub(r"<[^>]+>", "", html.unescape(title)).strip()
            if url.startswith(("http://", "https://")) and clean_title:
                results.append({"title": clean_title, "url": url})
            if len(results) >= limit:
                break
        return {"query": clean_query, "results": results, "source": "DuckDuckGo"}

    def fetch_web_page(self, url: str, max_characters: int = 12_000) -> dict[str, object]:
        parsed = urlparse(url.strip())
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Only public HTTP and HTTPS URLs are supported.")
        host = parsed.hostname or ""
        if host.casefold() == "localhost":
            raise ValueError("Private and loopback addresses are not supported.")
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            address = None
        if address is not None and not address.is_global:
            raise ValueError("Private and loopback addresses are not supported.")
        response = self._client.get(url)
        response.raise_for_status()
        text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", response.text, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", html.unescape(text)).strip()
        return {
            "url": str(response.url),
            "status": response.status_code,
            "content": text[:max_characters],
        }
