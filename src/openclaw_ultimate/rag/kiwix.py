from __future__ import annotations

from html.parser import HTMLParser
from urllib.parse import urljoin

import httpx

from openclaw_ultimate.rag.models import KnowledgeChunk, KnowledgeSearchHit


class _SearchParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str, str]] = []
        self._href: str | None = None
        self._pending_href: str | None = None
        self._title: str | None = None
        self._text: list[str] = []
        self._in_citation = False
        self._citation: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            if tag == "cite" and self._title is not None:
                self._in_citation = True
                self._citation = []
            return
        href = dict(attrs).get("href")
        if href and "/content/" in href:
            self._href, self._title, self._text = href, None, []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)
        elif self._in_citation:
            self._citation.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._href is not None:
            title = " ".join("".join(self._text).split())
            if title:
                self._title = title
                self._pending_href = self._href
            self._href = None
            self._text = []
        elif tag == "cite" and self._title is not None:
            citation = " ".join("".join(self._citation).split())
            self.links.append((self._pending_href or "", self._title, citation))
            self._pending_href = None
            self._title = None
            self._in_citation = False
            self._citation = []


class KiwixKnowledgeClient:
    """Search locally hosted ZIM archives without importing them into SQLite."""

    def __init__(
        self,
        *,
        base_url: str,
        timeout: float = 8.0,
        result_limit: int = 3,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/") + "/"
        self.timeout = timeout
        self.result_limit = result_limit
        self._client = client

    async def search(self, query: str, *, limit: int | None = None) -> tuple[KnowledgeSearchHit, ...]:
        maximum = min(limit or self.result_limit, self.result_limit)
        if maximum < 1:
            return ()
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self.timeout)
        try:
            response = await client.get(urljoin(self.base_url, "search"), params={"pattern": query})
            response.raise_for_status()
            parser = _SearchParser()
            parser.feed(response.text)
            hits: list[KnowledgeSearchHit] = []
            seen: set[str] = set()
            for href, title, snippet in parser.links:
                article_url = urljoin(self.base_url, href)
                if article_url in seen:
                    continue
                seen.add(article_url)
                if not snippet:
                    continue
                content = f"{title}\n{snippet[:3500]}"
                chunk = KnowledgeChunk(
                    chunk_id=article_url,
                    source_path=article_url,
                    ordinal=0,
                    start_line=1,
                    content=content,
                    content_hash=article_url,
                    embedding=(),
                )
                rank_score = max(0.55, 0.9 - (len(hits) * 0.08))
                hits.append(
                    KnowledgeSearchHit(
                        chunk=chunk,
                        score=rank_score,
                        vector_score=0.0,
                        lexical_score=rank_score,
                    )
                )
                if len(hits) >= maximum:
                    break
            return tuple(hits)
        except (httpx.HTTPError, OSError):
            return ()
        finally:
            if owns_client:
                await client.aclose()

    async def is_available(self) -> bool:
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self.timeout)
        try:
            response = await client.get(self.base_url)
            return response.is_success
        except (httpx.HTTPError, OSError):
            return False
        finally:
            if owns_client:
                await client.aclose()
