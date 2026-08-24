from __future__ import annotations

import asyncio

import httpx

from openclaw_ultimate.rag import KiwixKnowledgeClient


def test_kiwix_search_returns_article_text_and_citation() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/search":
            return httpx.Response(
                200,
                text=(
                    '<html><a href="/content/wiki/A/Test">化学</a>'
                    '<cite>研究物质的性质与变化。</cite></html>'
                ),
            )
        return httpx.Response(404)

    async def run() -> tuple:
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
        ) as client:
            source = KiwixKnowledgeClient(
                base_url="http://127.0.0.1:18080",
                client=client,
            )
            return await source.search("化学")

    hits = asyncio.run(run())

    assert len(hits) == 1
    assert "研究物质" in hits[0].chunk.content
    assert hits[0].chunk.citation.startswith("http://127.0.0.1:18080/content/")


def test_kiwix_search_is_optional_when_server_is_unavailable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("offline", request=request)

    async def run() -> tuple:
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
        ) as client:
            source = KiwixKnowledgeClient(
                base_url="http://127.0.0.1:18080",
                client=client,
            )
            return await source.search("test")

    assert asyncio.run(run()) == ()
