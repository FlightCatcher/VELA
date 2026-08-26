from __future__ import annotations

import json

from openclaw_ultimate.app import build_default_agent
from openclaw_ultimate.config import Settings
from openclaw_ultimate.models import OpenAICompatibleModel
from openclaw_ultimate.tools.desktop import DesktopTools


def test_build_default_agent() -> None:
    settings = Settings(
        _env_file=None,
        ollama_base_url="http://localhost:11434",
        ollama_model="qwen3:8b",
        model_timeout=120,
        temperature=0.1,
        max_steps=6,
    )

    agent = build_default_agent(settings)

    assert agent.name == "vela"
    assert agent.max_steps == 6
    assert isinstance(
        agent.model,
        OpenAICompatibleModel,
    )
    assert agent.model.base_url == "http://localhost:11434/v1"
    assert agent.model.model == "qwen3:8b"
    assert "add" in agent.tools
    assert "list_files" in agent.tools
    assert "read_text_file" in agent.tools
    assert "search_text" in agent.tools
    assert "run_command" not in agent.tools


def test_build_default_agent_can_enable_shell(
    tmp_path,
) -> None:
    settings = Settings(
        _env_file=None,
        workspace_root=tmp_path,
        enable_shell_tool=True,
    )

    agent = build_default_agent(settings)

    assert "run_command" in agent.tools


def test_build_default_agent_registers_enabled_web_and_desktop_plugins(
    tmp_path,
    monkeypatch,
) -> None:
    class FakeBackend:
        def list_windows(self):
            return []

        def activate_window(self, title):
            return {"title": title}

        def click(self, x, y):
            return {"x": x, "y": y}

        def type_text(self, text):
            return {"text": text}

        def press_key(self, key):
            return {"key": key}

        def screenshot(self, output_path, window_title=None):
            return {"path": str(output_path), "window_title": window_title}

        def cursor_position(self):
            return {"x": 0, "y": 0}

        def move_cursor(self, x, y):
            return {"x": x, "y": y}

        def double_click(self, x, y):
            return {"x": x, "y": y}

        def scroll(self, amount):
            return {"amount": amount}

    monkeypatch.setattr(DesktopTools, "windows", classmethod(lambda cls: cls(FakeBackend())))
    settings = Settings(
        _env_file=None,
        workspace_root=tmp_path,
        web_search_enabled=True,
        desktop_control_enabled=True,
    )

    agent = build_default_agent(settings)

    assert "web_search" in agent.tools
    assert "fetch_web_page" in agent.tools
    assert "list_desktop_windows" in agent.tools
    assert "desktop_click" in agent.tools
    assert "desktop_type_text" in agent.tools
    assert "desktop_screenshot" in agent.tools
    assert "desktop_move_cursor" in agent.tools
    assert "desktop_double_click" in agent.tools
    assert "desktop_scroll" in agent.tools


def test_vision_backend_remains_local_when_chat_uses_cloud_api(tmp_path) -> None:
    settings = Settings(
        _env_file=None,
        workspace_root=tmp_path,
        ollama_base_url="https://api.deepseek.com",
        vision_base_url="http://127.0.0.1:11434",
        vision_enabled=True,
    )

    assert settings.ollama_base_url == "https://api.deepseek.com"
    assert settings.vision_base_url == "http://127.0.0.1:11434"


def test_build_default_agent_loads_relative_mcp_config_from_workspace(
    tmp_path,
    monkeypatch,
) -> None:
    config_path = tmp_path / "configs" / "mcp.json"
    config_path.parent.mkdir()
    config_path.write_text(
        json.dumps(
            {
                "servers": [
                    {
                        "name": "local",
                        "command": ["python", "server.py"],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    unrelated = tmp_path / "unrelated"
    unrelated.mkdir()
    monkeypatch.chdir(unrelated)
    settings = Settings(
        _env_file=None,
        workspace_root=tmp_path,
        mcp_enabled=True,
        mcp_servers_path="configs/mcp.json",
        openclaw_enabled=False,
        comfyui_enabled=False,
        knowledge_enabled=False,
    )

    agent = build_default_agent(settings)

    assert "list_mcp_tools" in agent.tools
