from __future__ import annotations

from pathlib import Path

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

    def screenshot(
        self,
        output_path: Path,
        window_title: str | None = None,
    ) -> dict[str, object]:
        return {"captured": True, "path": str(output_path), "window_title": window_title}

    def cursor_position(self) -> dict[str, object]:
        return {"x": 4, "y": 5}

    def move_cursor(self, x: int, y: int) -> dict[str, object]:
        return {"moved": True, "x": x, "y": y}

    def double_click(self, x: int, y: int) -> dict[str, object]:
        return {"double_clicked": True, "x": x, "y": y}

    def scroll(self, amount: int) -> dict[str, object]:
        return {"scrolled": True, "amount": amount}


def test_desktop_tools_delegate_to_the_backend() -> None:
    tools = DesktopTools(FakeDesktopBackend())

    assert tools.list_windows()["windows"][0]["title"] == "Notes"
    assert tools.activate_window("Notes")["activated"] is True
    assert tools.click(20, 30) == {"clicked": True, "x": 20, "y": 30}
    assert tools.type_text("VELA")["characters"] == 4
    assert tools.press_key("enter")["pressed"] == "enter"
    assert tools.screenshot()["captured"] is True
    assert tools.screenshot(window_title="Notes")["window_title"] == "Notes"
    assert tools.cursor_position() == {"x": 4, "y": 5}
    assert tools.move_cursor(8, 9)["moved"] is True
    assert tools.double_click(10, 11)["double_clicked"] is True
    assert tools.scroll(-3) == {"scrolled": True, "amount": -3}
