from __future__ import annotations

import ctypes
import os
from ctypes import wintypes
from dataclasses import dataclass
from typing import Any, ClassVar, Protocol, cast


class DesktopBackend(Protocol):
    def list_windows(self) -> list[dict[str, object]]: ...
    def activate_window(self, title: str) -> dict[str, object]: ...
    def click(self, x: int, y: int) -> dict[str, object]: ...
    def type_text(self, text: str) -> dict[str, object]: ...
    def press_key(self, key: str) -> dict[str, object]: ...


class WindowsDesktopBackend:
    """Small dependency-free Win32 desktop adapter for explicit full-access use."""

    _KEYS: ClassVar[dict[str, int]] = {
        "enter": 0x0D,
        "escape": 0x1B,
        "tab": 0x09,
        "backspace": 0x08,
        "space": 0x20,
        "left": 0x25,
        "up": 0x26,
        "right": 0x27,
        "down": 0x28,
    }

    def __init__(self) -> None:
        if os.name != "nt":
            raise RuntimeError("Desktop control is currently available on Windows only.")
        windll = getattr(ctypes, "windll", None)
        if windll is None:
            raise RuntimeError("The Win32 desktop API is unavailable.")
        self._user32: Any = windll.user32

    def list_windows(self) -> list[dict[str, object]]:
        windows: list[dict[str, object]] = []
        callback_factory = getattr(ctypes, "WINFUNCTYPE", ctypes.CFUNCTYPE)
        callback_type = callback_factory(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)

        @callback_type
        def collect(hwnd: int, _lparam: int) -> bool:
            if not self._user32.IsWindowVisible(hwnd):
                return True
            length = self._user32.GetWindowTextLengthW(hwnd)
            if length <= 0:
                return True
            buffer = ctypes.create_unicode_buffer(length + 1)
            self._user32.GetWindowTextW(hwnd, buffer, length + 1)
            title = buffer.value.strip()
            if title:
                windows.append({"handle": int(hwnd), "title": title})
            return True

        self._user32.EnumWindows(collect, 0)
        return windows[:100]

    def activate_window(self, title: str) -> dict[str, object]:
        query = title.strip().casefold()
        windows = self.list_windows()
        exact_matches = [item for item in windows if query == str(item["title"]).casefold()]
        matches = exact_matches or [
            item for item in windows if query in str(item["title"]).casefold()
        ]
        if not query or len(matches) != 1:
            raise ValueError(f"Expected one matching window, found {len(matches)}.")
        hwnd = cast(int, matches[0]["handle"])
        self._user32.ShowWindow(hwnd, 9)
        if not self._user32.SetForegroundWindow(hwnd):
            raise RuntimeError("Windows did not allow the target window to be activated.")
        return {"activated": True, **matches[0]}

    def click(self, x: int, y: int) -> dict[str, object]:
        if x < 0 or y < 0:
            raise ValueError("Desktop coordinates cannot be negative.")
        self._user32.SetCursorPos(x, y)
        self._user32.mouse_event(0x0002, 0, 0, 0, 0)
        self._user32.mouse_event(0x0004, 0, 0, 0, 0)
        return {"clicked": True, "x": x, "y": y}

    def type_text(self, text: str) -> dict[str, object]:
        clean = str(text)
        if not clean or len(clean) > 4000:
            raise ValueError("Text must contain between 1 and 4000 characters.")
        for character in clean:
            code = ord(character)
            self._user32.keybd_event(0, code, 0x0004, 0)
            self._user32.keybd_event(0, code, 0x0004 | 0x0002, 0)
        return {"typed": True, "characters": len(clean)}

    def press_key(self, key: str) -> dict[str, object]:
        normalized = key.strip().casefold()
        virtual_key = self._KEYS.get(normalized)
        if virtual_key is None:
            raise ValueError(f"Unsupported key: {key}")
        self._user32.keybd_event(virtual_key, 0, 0, 0)
        self._user32.keybd_event(virtual_key, 0, 0x0002, 0)
        return {"pressed": normalized}


@dataclass(slots=True)
class DesktopTools:
    backend: DesktopBackend

    @classmethod
    def windows(cls) -> DesktopTools:
        return cls(WindowsDesktopBackend())

    def list_windows(self) -> dict[str, object]:
        return {"windows": self.backend.list_windows()}

    def activate_window(self, title: str) -> dict[str, object]:
        return self.backend.activate_window(title)

    def click(self, x: int, y: int) -> dict[str, object]:
        return self.backend.click(x, y)

    def type_text(self, text: str) -> dict[str, object]:
        return self.backend.type_text(text)

    def press_key(self, key: str) -> dict[str, object]:
        return self.backend.press_key(key)
