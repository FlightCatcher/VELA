from __future__ import annotations

import httpx
import pytest

from openclaw_ultimate.tools import WebTools


def test_web_search_extracts_public_results() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "html.duckduckgo.com"
        return httpx.Response(
            200,
            text=(
                '<a class="result__a" '
                'href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fnews">'
                "Example <b>News</b></a>"
            ),
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = WebTools(client=client).web_search("vela")

    assert result["results"] == [{"title": "Example News", "url": "https://example.com/news"}]


def test_fetch_web_page_removes_script_and_markup() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<main>Hello <b>VELA</b></main><script>secret()</script>")

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = WebTools(client=client).fetch_web_page("https://example.com")

    assert result["content"] == "Hello VELA"


def test_fetch_web_page_rejects_local_file_scheme() -> None:
    with pytest.raises(ValueError, match="HTTP"):
        WebTools().fetch_web_page("file:///etc/passwd")
