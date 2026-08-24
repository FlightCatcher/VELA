from __future__ import annotations

import asyncio
from collections.abc import Sequence
from pathlib import Path

import pytest

from openclaw_ultimate.core.messages import Message
from openclaw_ultimate.core.runtime import Agent
from openclaw_ultimate.core.tools import ToolDefinition
from openclaw_ultimate.governance import (
    PlanControlState,
    SQLiteGovernanceStore,
)
from openclaw_ultimate.models.base import ModelResponse
from openclaw_ultimate.planner import (
    PlanExecutionError,
    PlanExecutor,
    PlanStatus,
    PlanStep,
    SQLitePlanStore,
    StepStatus,
    TaskPlan,
)


class ExecutorFakeModel:
    def __init__(
        self,
        responses: Sequence[str | Exception],
    ) -> None:
        self.responses = list(responses)
        self.prompts: list[str] = []

    async def complete(
        self,
        messages: Sequence[Message],
        tools: Sequence[ToolDefinition],
    ) -> ModelResponse:
        self.prompts.append(messages[-1].content or "")
        response = self.responses.pop(0)

        if isinstance(response, Exception):
            raise response

        return ModelResponse(content=response)


def create_plan() -> TaskPlan:
    return TaskPlan.create(
        goal="检查并总结",
        steps=(
            PlanStep(
                id="inspect",
                title="检查",
                description="检查项目",
            ),
            PlanStep(
                id="summarize",
                title="总结",
                description="总结检查结果",
                dependencies=("inspect",),
            ),
        ),
    )


def test_executor_completes_steps_in_dependency_order(
    tmp_path: Path,
) -> None:
    async def run_test() -> None:
        model = ExecutorFakeModel(("检查完成", "总结完成"))
        agent = Agent(
            name="executor-test",
            model=model,
        )
        store = SQLitePlanStore(tmp_path / "plans.db")
        plan = create_plan()
        store.save(plan)

        result = await PlanExecutor().execute(
            plan=plan,
            agent=agent,
            store=store,
        )

        assert result.plan.status == (PlanStatus.COMPLETED)
        assert result.completed_step_ids == (
            "inspect",
            "summarize",
        )
        assert [step.status for step in result.plan.steps] == [
            StepStatus.COMPLETED,
            StepStatus.COMPLETED,
        ]
        assert "检查完成" in model.prompts[1]
        assert store.get(plan.id) == result.plan

    asyncio.run(run_test())


def test_executor_persists_failure(
    tmp_path: Path,
) -> None:
    async def run_test() -> None:
        model = ExecutorFakeModel(
            (
                "检查完成",
                RuntimeError("model failed"),
            )
        )
        agent = Agent(
            name="executor-test",
            model=model,
        )
        store = SQLitePlanStore(tmp_path / "plans.db")
        plan = create_plan()
        store.save(plan)

        result = await PlanExecutor().execute(
            plan=plan,
            agent=agent,
            store=store,
        )

        assert result.plan.status == (PlanStatus.FAILED)
        assert result.failed_step_id == "summarize"
        assert result.plan.steps[1].status == (StepStatus.FAILED)
        assert "model failed" in (result.plan.steps[1].error or "")

    asyncio.run(run_test())


def test_executor_rejects_completed_plan(
    tmp_path: Path,
) -> None:
    plan = create_plan().with_status(PlanStatus.COMPLETED)
    store = SQLitePlanStore(tmp_path / "plans.db")

    with pytest.raises(
        PlanExecutionError,
        match="completed",
    ):
        asyncio.run(
            PlanExecutor().execute(
                plan=plan,
                agent=Agent(
                    name="executor-test",
                    model=ExecutorFakeModel(()),
                ),
                store=store,
            )
        )


def test_executor_honors_persisted_pause_before_running_steps(
    tmp_path: Path,
) -> None:
    async def run_test() -> None:
        plan = create_plan()
        store = SQLitePlanStore(tmp_path / "plans.db")
        governance = SQLiteGovernanceStore(tmp_path / "governance.db")
        store.save(plan)
        governance.set_plan_control(plan.id, PlanControlState.PAUSE)

        result = await PlanExecutor(
            control_store=governance,
        ).execute(
            plan=plan,
            agent=Agent(
                name="executor-test",
                model=ExecutorFakeModel(()),
            ),
            store=store,
        )

        assert result.plan.status == PlanStatus.PAUSED
        assert result.interrupted_reason == "paused"
        assert result.completed_step_ids == ()

    asyncio.run(run_test())


def test_executor_cancels_an_in_flight_step_and_persists_safe_state(
    tmp_path: Path,
) -> None:
    async def run_test() -> None:
        started = asyncio.Event()
        cancelled = asyncio.Event()

        class BlockingModel:
            async def complete(self, messages, tools) -> ModelResponse:
                started.set()
                try:
                    await asyncio.sleep(30)
                except asyncio.CancelledError:
                    cancelled.set()
                    raise
                return ModelResponse(content="不应完成")

        plan = create_plan()
        store = SQLitePlanStore(tmp_path / "plans.db")
        governance = SQLiteGovernanceStore(tmp_path / "governance.db")
        store.save(plan)
        execution = asyncio.create_task(
            PlanExecutor(control_store=governance).execute(
                plan=plan,
                agent=Agent(name="cancel-test", model=BlockingModel()),
                store=store,
            )
        )
        await asyncio.wait_for(started.wait(), timeout=2)
        governance.set_plan_control(plan.id, PlanControlState.CANCEL)
        result = await asyncio.wait_for(execution, timeout=2)

        assert cancelled.is_set()
        assert result.plan.status == PlanStatus.CANCELLED
        assert result.plan.steps[0].status == StepStatus.PENDING
        assert result.interrupted_reason == "cancelled"
        assert store.get(plan.id) == result.plan

    asyncio.run(run_test())


def test_executor_runs_consecutive_plans_without_state_leak(tmp_path: Path) -> None:
    async def run_test() -> None:
        store = SQLitePlanStore(tmp_path / "plans.db")
        executor = PlanExecutor()
        results = []
        for index in range(2):
            plan = TaskPlan.create(
                goal=f"连续任务 {index}",
                steps=(PlanStep(id="step", title="执行", description="执行一次"),),
            )
            store.save(plan)
            result = await executor.execute(
                plan=plan,
                agent=Agent(
                    name=f"consecutive-{index}",
                    model=ExecutorFakeModel((f"结果 {index}",)),
                ),
                store=store,
            )
            results.append(result)

        assert [result.plan.status for result in results] == [
            PlanStatus.COMPLETED,
            PlanStatus.COMPLETED,
        ]
        assert [result.plan.steps[0].result for result in results] == ["结果 0", "结果 1"]
        assert results[0].plan.id != results[1].plan.id

    asyncio.run(run_test())


def test_restart_recovery_pauses_plan_and_resets_running_step(tmp_path: Path) -> None:
    store = SQLitePlanStore(tmp_path / "plans.db")
    original = create_plan().with_steps(
        (
            create_plan().steps[0].with_status(StepStatus.RUNNING),
            create_plan().steps[1],
        ),
        status=PlanStatus.RUNNING,
    )
    store.save(original)

    recovered = store.recover_interrupted_plans()

    assert len(recovered) == 1
    assert recovered[0].status == PlanStatus.PAUSED
    assert recovered[0].steps[0].status == StepStatus.PENDING
    assert "restart" in (recovered[0].steps[0].error or "")
    assert store.recover_interrupted_plans() == ()
