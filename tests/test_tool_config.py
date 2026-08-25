from __future__ import annotations

import pytest
from pydantic import ValidationError

from openclaw_ultimate.config import Settings


def test_workspace_tool_settings_defaults() -> None:
    settings = Settings(_env_file=None)

    assert settings.enable_shell_tool is False
    assert settings.workspace_max_read_bytes == 1_000_000
    assert settings.workspace_max_results == 200
    assert settings.shell_allowed_commands == (
        "git",
        "uv",
        "python",
        "pytest",
    )
    assert settings.shell_timeout == 30


def test_workspace_tool_limits_are_validated() -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            workspace_max_read_bytes=0,
        )

    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            shell_timeout=0,
        )


def test_full_access_permission_settings_are_explicit() -> None:
    settings = Settings(
        _env_file=None,
        permission_profile="full_access",
        enable_shell_tool=True,
        shell_allow_all_commands=True,
        workspace_allow_absolute_paths=True,
    )

    assert settings.permission_profile == "full_access"
    assert settings.shell_allow_all_commands is True
    assert settings.workspace_allow_absolute_paths is True
