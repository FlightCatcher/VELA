from __future__ import annotations

from openclaw_ultimate.tools.desktop import DesktopTools


class FakeDesktopBackend:
    def list_windows(self) -> list[dict[str, object]]:
        return [{"handle": 7, "title": "Notes"}]

    def activate_window(self, title: str) -> dict[str, object]:
        return {"activated": True, "title": title}

    def click(self, x: int, y: int) -> dict[str, object]:
        return {"clicked": True, "x": x, "y": y}

    def type_text(self, text: str) -> dict[str, object]:
        return {"typed": True, "characters": len(text)}

    def press_key(self, key: str) -> dict[str, object]:
        return {"pressed": key}


def test_desktop_tools_delegate_to_the_backend() -> None:
    tools = DesktopTools(FakeDesktopBackend())

    assert tools.list_windows()["windows"][0]["title"] == "Notes"
    assert tools.activate_window("Notes")["activated"] is True
    assert tools.click(20, 30) == {"clicked": True, "x": 20, "y": 30}
    assert tools.type_text("VELA")["characters"] == 4
    assert tools.press_key("enter")["pressed"] == "enter"
