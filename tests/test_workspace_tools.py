from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

from openclaw_ultimate.governance import (
    ConfirmationRequired,
    SQLiteGovernanceStore,
)
from openclaw_ultimate.tools import (
    SafeCommandRunner,
    WorkspaceAccessError,
    WorkspaceTools,
)


def test_workspace_lists_reads_and_searches(
    tmp_path: Path,
) -> None:
    source = tmp_path / "src"
    source.mkdir()
    file_path = source / "example.py"
    file_path.write_text(
        "first line\nOpenClaw marker\n",
        encoding="utf-8",
    )
    workspace = WorkspaceTools(tmp_path)

    listing = workspace.list_files(
        "src",
        "*.py",
    )
    read_result = workspace.read_text_file("src/example.py")
    search_result = workspace.search_text(
        "openclaw",
        pattern="*.py",
    )

    assert listing["entries"] == [
        {
            "path": "src/example.py",
            "type": "file",
            "size": file_path.stat().st_size,
        }
    ]
    assert read_result["content"] == ("first line\nOpenClaw marker\n")
    assert search_result["matches"] == [
        {
            "path": "src/example.py",
            "line": 2,
            "text": "OpenClaw marker",
        }
    ]


def test_workspace_rejects_escape_and_private_files(
    tmp_path: Path,
) -> None:
    workspace = WorkspaceTools(tmp_path)
    (tmp_path / ".env").write_text(
        "SECRET=value",
        encoding="utf-8",
    )
    outside = tmp_path.parent / "outside.txt"

    with pytest.raises(WorkspaceAccessError):
        workspace.resolve_path(outside)

    with pytest.raises(WorkspaceAccessError):
        workspace.read_text_file(".env")

    with pytest.raises(WorkspaceAccessError):
        workspace.list_files(
            ".",
            "../*",
        )


def test_workspace_enforces_read_limit(
    tmp_path: Path,
) -> None:
    (tmp_path / "large.txt").write_text(
        "12345",
        encoding="utf-8",
    )
    workspace = WorkspaceTools(
        tmp_path,
        max_read_bytes=4,
    )

    with pytest.raises(
        ValueError,
        match="read limit",
    ):
        workspace.read_text_file("large.txt")


def test_workspace_allows_absolute_path_only_when_explicitly_enabled(
    tmp_path: Path,
) -> None:
    workspace_root = tmp_path / "workspace"
    workspace_root.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("allowed in full access", encoding="utf-8")
    workspace = WorkspaceTools(workspace_root, allow_absolute_paths=True)

    result = workspace.read_text_file(str(outside))

    assert result["content"] == "allowed in full access"
    assert Path(str(result["path"])) == outside


def test_safe_command_runner_executes_allowed_command(
    tmp_path: Path,
) -> None:
    async def run_test() -> None:
        workspace = WorkspaceTools(tmp_path)
        governance = SQLiteGovernanceStore(tmp_path / "governance.db")
        runner = SafeCommandRunner(
            workspace,
            allowed_commands=("python",),
            timeout=10,
            governance_store=governance,
        )
        with pytest.raises(ConfirmationRequired) as required:
            await runner.run_command(
                sys.executable,
                ("-c", "print('workspace-ok')"),
            )
        governance.resolve_confirmation(
            required.value.request.confirmation_id,
            approve=True,
        )
        result = await runner.run_command(
            sys.executable,
            ("-c", "print('workspace-ok')"),
        )

        assert result["exit_code"] == 0
        assert str(result["stdout"]).splitlines() == ["workspace-ok"]
        assert result["working_directory"] == "."

    asyncio.run(run_test())


def test_safe_command_runner_rejects_command(
    tmp_path: Path,
) -> None:
    async def run_test() -> None:
        runner = SafeCommandRunner(
            WorkspaceTools(tmp_path),
            allowed_commands=("git",),
        )

        with pytest.raises(
            WorkspaceAccessError,
            match="not allowed",
        ):
            await runner.run_command(
                sys.executable,
                ("-c", "print('blocked')"),
            )

    asyncio.run(run_test())


def test_full_access_runner_can_execute_unlisted_command_without_confirmation(
    tmp_path: Path,
) -> None:
    async def run_test() -> None:
        runner = SafeCommandRunner(
            WorkspaceTools(tmp_path),
            allowed_commands=(),
            allow_all_commands=True,
            require_confirmation=False,
        )
        result = await runner.run_command(sys.executable, ("--version",))
        assert result["exit_code"] == 0

    asyncio.run(run_test())
