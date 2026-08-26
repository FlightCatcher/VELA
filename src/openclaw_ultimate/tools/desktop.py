from __future__ import annotations

import ctypes
import os
from ctypes import wintypes
from dataclasses import dataclass
from pathlib import Path
from typing import Any, ClassVar, Protocol, cast


class DesktopBackend(Protocol):
    def list_windows(self) -> list[dict[str, object]]: ...
    def activate_window(self, title: str) -> dict[str, object]: ...
    def click(self, x: int, y: int) -> dict[str, object]: ...
    def type_text(self, text: str) -> dict[str, object]: ...
    def press_key(self, key: str) -> dict[str, object]: ...
    def screenshot(self, output_path: Path, window_title: str | None = None) -> dict[str, object]: ...
    def cursor_position(self) -> dict[str, object]: ...
    def move_cursor(self, x: int, y: int) -> dict[str, object]: ...
    def double_click(self, x: int, y: int) -> dict[str, object]: ...
    def scroll(self, amount: int) -> dict[str, object]: ...


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
        self._user32.BringWindowToTop(hwnd)
        # A short Alt transition allows an explicitly user-authorized desktop
        # agent to cooperate with Windows' foreground-lock rules without
        # changing any system setting.
        self._user32.keybd_event(0x12, 0, 0, 0)
        activated = bool(self._user32.SetForegroundWindow(hwnd))
        self._user32.keybd_event(0x12, 0, 0x0002, 0)
        if not activated:
            raise RuntimeError("Windows did not allow the target window to be activated.")
        return {"activated": True, **matches[0]}

    def click(self, x: int, y: int) -> dict[str, object]:
        if x < 0 or y < 0:
            raise ValueError("Desktop coordinates cannot be negative.")
        self._user32.SetCursorPos(x, y)
        self._user32.mouse_event(0x0002, 0, 0, 0, 0)
        self._user32.mouse_event(0x0004, 0, 0, 0, 0)
        return {"clicked": True, "x": x, "y": y}

    def double_click(self, x: int, y: int) -> dict[str, object]:
        self.click(x, y)
        self.click(x, y)
        return {"double_clicked": True, "x": x, "y": y}

    def cursor_position(self) -> dict[str, object]:
        point = wintypes.POINT()
        if not self._user32.GetCursorPos(ctypes.byref(point)):
            raise RuntimeError("Windows did not return the cursor position.")
        return {"x": int(point.x), "y": int(point.y)}

    def move_cursor(self, x: int, y: int) -> dict[str, object]:
        if x < 0 or y < 0:
            raise ValueError("Desktop coordinates cannot be negative.")
        if not self._user32.SetCursorPos(x, y):
            raise RuntimeError("Windows did not move the cursor.")
        return {"moved": True, "x": x, "y": y}

    def scroll(self, amount: int) -> dict[str, object]:
        if amount == 0 or abs(amount) > 20:
            raise ValueError("Scroll amount must be between -20 and 20, excluding zero.")
        self._user32.mouse_event(0x0800, 0, 0, amount * 120, 0)
        return {"scrolled": True, "amount": amount}

    def screenshot(
        self,
        output_path: Path,
        window_title: str | None = None,
    ) -> dict[str, object]:
        try:
            from PIL import ImageGrab
        except ImportError as error:
            raise RuntimeError("Desktop screenshots require the Pillow package.") from error
        output_path.parent.mkdir(parents=True, exist_ok=True)
        hwnd: int | None = None
        if window_title and window_title.strip():
            query = window_title.strip().casefold()
            windows = self.list_windows()
            exact = [item for item in windows if str(item["title"]).casefold() == query]
            matches = exact or [
                item for item in windows if query in str(item["title"]).casefold()
            ]
            if len(matches) != 1:
                raise ValueError(f"Expected one matching window, found {len(matches)}.")
            hwnd = cast(int, matches[0]["handle"])
        screen_left: int
        screen_top: int
        logical_width: int
        logical_height: int
        if hwnd is None:
            image = ImageGrab.grab(all_screens=True)
            screen_left = int(self._user32.GetSystemMetrics(76))
            screen_top = int(self._user32.GetSystemMetrics(77))
            logical_width = max(1, int(self._user32.GetSystemMetrics(78)))
            logical_height = max(1, int(self._user32.GetSystemMetrics(79)))
        else:
            self._user32.ShowWindow(hwnd, 9)
            self._user32.BringWindowToTop(hwnd)
            rectangle = wintypes.RECT()
            if not self._user32.GetWindowRect(hwnd, ctypes.byref(rectangle)):
                raise RuntimeError("Windows did not return the target window bounds.")
            desktop = ImageGrab.grab(all_screens=True)
            virtual_left = int(self._user32.GetSystemMetrics(76))
            virtual_top = int(self._user32.GetSystemMetrics(77))
            virtual_width = max(1, int(self._user32.GetSystemMetrics(78)))
            virtual_height = max(1, int(self._user32.GetSystemMetrics(79)))
            scale_x = desktop.width / virtual_width
            scale_y = desktop.height / virtual_height
            crop_box = (
                round((int(rectangle.left) - virtual_left) * scale_x),
                round((int(rectangle.top) - virtual_top) * scale_y),
                round((int(rectangle.right) - virtual_left) * scale_x),
                round((int(rectangle.bottom) - virtual_top) * scale_y),
            )
            image = desktop.crop(crop_box)
            screen_left = int(rectangle.left)
            screen_top = int(rectangle.top)
            logical_width = max(1, int(rectangle.right) - int(rectangle.left))
            logical_height = max(1, int(rectangle.bottom) - int(rectangle.top))
        original_size = (image.width, image.height)
        if image.width > 2048 or image.height > 2048:
            image.thumbnail((2048, 2048))
        image.save(output_path, format="PNG")
        return {
            "captured": True,
            "path": str(output_path),
            "width": image.width,
            "height": image.height,
            "original_width": original_size[0],
            "original_height": original_size[1],
            "window_title": window_title,
            "screen_left": screen_left,
            "screen_top": screen_top,
            "coordinate_scale_x": logical_width / image.width,
            "coordinate_scale_y": logical_height / image.height,
            "coordinate_help": (
                "absolute_x = screen_left + image_x * coordinate_scale_x; "
                "absolute_y = screen_top + image_y * coordinate_scale_y"
            ),
            "next_step": "Call analyze_image with this path before clicking.",
        }

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
    screenshot_root: Path = Path(".vela") / "desktop"

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

    def screenshot(
        self,
        filename: str = "current-screen.png",
        window_title: str | None = None,
    ) -> dict[str, object]:
        safe_name = Path(filename).name
        if not safe_name.casefold().endswith(".png"):
            safe_name = f"{safe_name}.png"
        result = self.backend.screenshot(
            (self.screenshot_root / safe_name).resolve(),
            window_title,
        )
        result["workspace_path"] = (self.screenshot_root / safe_name).as_posix()
        return result

    def cursor_position(self) -> dict[str, object]:
        return self.backend.cursor_position()

    def move_cursor(self, x: int, y: int) -> dict[str, object]:
        return self.backend.move_cursor(x, y)

    def double_click(self, x: int, y: int) -> dict[str, object]:
        return self.backend.double_click(x, y)

    def scroll(self, amount: int) -> dict[str, object]:
        return self.backend.scroll(amount)
