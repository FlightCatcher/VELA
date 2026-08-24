from __future__ import annotations

import asyncio

import pytest

from openclaw_ultimate.bridge import handle_request
from openclaw_ultimate.config import Settings
from openclaw_ultimate.planner import (
    ErrorContext,
    PlanStatus,
    PlanStep,
    ReflectionEngine,
    SQLitePlanStore,
    StepStatus,
    TaskPlan,
)


def test_bridge_status_reports_recursion_guard(
    tmp_path,
) -> None:
    settings = Settings(
        _env_file=None,
        planner_db_path=tmp_path / "plans.db",
    )

    result = asyncio.run(
        handle_request(
            {"action": "status"},
            settings=settings,
        )
    )

    assert result["ok"] is True
    assert result["data"]["plan_count"] == 0
    assert result["data"]["openclaw_recursion_guard"] is True


def test_bridge_plan_show_returns_persisted_plan(
    tmp_path,
) -> None:
    settings = Settings(
        _env_file=None,
        planner_db_path=tmp_path / "plans.db",
    )
    plan = TaskPlan.create(
        goal="检查 README",
        steps=(
            PlanStep(
                id="step-1",
                title="读取 README",
                description="读取 README.md",
                tool_hint="read_text_file",
            ),
        ),
    )
    SQLitePlanStore(settings.planner_db_path).save(plan)

    result = asyncio.run(
        handle_request(
            {
                "action": "plan_show",
                "plan_id": plan.id,
            },
            settings=settings,
        )
    )

    assert result["data"]["plan"]["id"] == plan.id
    assert result["data"]["plan"]["goal"] == "检查 README"
    assert result["data"]["reflections"] == []
    assert result["data"]["verifications"] == []


def test_bridge_knowledge_status_reports_local_index(
    tmp_path,
) -> None:
    settings = Settings(
        _env_file=None,
        planner_db_path=tmp_path / "plans.db",
        knowledge_root=tmp_path / "knowledge",
        knowledge_db_path=tmp_path / "knowledge.db",
    )

    result = asyncio.run(
        handle_request(
            {"action": "knowledge_status"},
            settings=settings,
        )
    )

    assert result["ok"] is True
    assert result["data"]["documents"] == 0
    assert result["data"]["chunks"] == 0
    assert result["data"]["database"].endswith("knowledge.db")


def test_bridge_rejects_unknown_action(
    tmp_path,
) -> None:
    settings = Settings(
        _env_file=None,
        planner_db_path=tmp_path / "plans.db",
    )

    with pytest.raises(ValueError, match="Unsupported"):
        asyncio.run(
            handle_request(
                {"action": "delete_everything"},
                settings=settings,
            )
        )


def test_bridge_creates_and_applies_versioned_replan_only_with_approval(tmp_path) -> None:
    settings = Settings(_env_file=None, planner_db_path=tmp_path / "plans.db")
    store = SQLitePlanStore(settings.planner_db_path)
    plan = TaskPlan.create(
        goal="读取文件",
        steps=(
            PlanStep(
                id="read",
                title="读取",
                description="读取 missing.txt",
                status=StepStatus.FAILED,
                error="FileNotFoundError: missing.txt",
            ),
        ),
    ).with_status(PlanStatus.FAILED)
    store.save(plan)
    reflection = ReflectionEngine().reflect(
        plan=plan,
        failed_step=plan.steps[0],
        error_context=ErrorContext("FileNotFoundError", "missing.txt"),
    )
    store.save_reflection(reflection)

    revised = asyncio.run(
        handle_request({"action": "plan_revise", "plan_id": plan.id}, settings=settings)
    )
    revision_id = revised["data"]["revisions"][0]["revision_id"]
    with pytest.raises(ValueError, match="approved=true"):
        asyncio.run(
            handle_request(
                {"action": "plan_apply", "revision_id": revision_id},
                settings=settings,
            )
        )

    applied = asyncio.run(
        handle_request(
            {"action": "plan_apply", "revision_id": revision_id, "approved": True},
            settings=settings,
        )
    )
    assert applied["data"]["parent_plan_id"] == plan.id
    assert applied["data"]["child_plan"]["id"] != plan.id
    assert store.get(plan.id).status == PlanStatus.FAILED


def test_bridge_recovers_interrupted_plan(tmp_path) -> None:
    settings = Settings(_env_file=None, planner_db_path=tmp_path / "plans.db")
    store = SQLitePlanStore(settings.planner_db_path)
    plan = TaskPlan.create(
        goal="恢复任务",
        steps=(
            PlanStep(
                id="work",
                title="工作",
                description="执行",
                status=StepStatus.RUNNING,
            ),
        ),
    ).with_status(PlanStatus.RUNNING)
    store.save(plan)

    result = asyncio.run(handle_request({"action": "plan_recover"}, settings=settings))

    assert result["data"]["recovered_count"] == 1
    assert store.get(plan.id).status == PlanStatus.PAUSED
