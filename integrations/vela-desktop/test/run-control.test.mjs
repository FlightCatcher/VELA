import assert from "node:assert/strict";
import test from "node:test";

import { RunCoordinator } from "../renderer/run-control.js";

test("starts a current run", () => {
  const runs = new RunCoordinator();
  const run = runs.start({ requestId: "one" });
  assert.equal(runs.isCurrent(run), true);
});

test("starting a new run invalidates the previous run", () => {
  const runs = new RunCoordinator();
  const oldRun = runs.start({ requestId: "old" });
  const newRun = runs.start({ requestId: "new" });
  assert.equal(runs.isCurrent(oldRun), false);
  assert.equal(runs.isCurrent(newRun), true);
});

test("cancel invalidates late results", () => {
  const runs = new RunCoordinator();
  const run = runs.start({ requestId: "late" });
  runs.cancel();
  assert.equal(runs.isCurrent(run), false);
});

test("cancel aborts an attached fetch controller", () => {
  const runs = new RunCoordinator();
  const controller = new AbortController();
  runs.start({ requestId: "image", controller });
  runs.cancel();
  assert.equal(controller.signal.aborted, true);
});

test("server run id attaches only to the active generation", () => {
  const runs = new RunCoordinator();
  const oldRun = runs.start({ requestId: "old" });
  runs.start({ requestId: "new" });
  assert.equal(runs.attachServerRunId(oldRun, "server-old"), false);
});

test("server run id is retained for cancellation", () => {
  const runs = new RunCoordinator();
  const run = runs.start({ requestId: "client" });
  assert.equal(runs.attachServerRunId(run, "server"), true);
  assert.equal(runs.cancel().serverRunId, "server");
});

test("finish succeeds only for current run", () => {
  const runs = new RunCoordinator();
  const run = runs.start({ requestId: "one" });
  assert.equal(runs.finish(run), true);
  assert.equal(runs.active, null);
});

test("late finish cannot clear a newer run", () => {
  const runs = new RunCoordinator();
  const oldRun = runs.start({ requestId: "old" });
  const newRun = runs.start({ requestId: "new" });
  assert.equal(runs.finish(oldRun), false);
  assert.equal(runs.isCurrent(newRun), true);
});

test("cancel with no active run is harmless", () => {
  assert.equal(new RunCoordinator().cancel(), null);
});

test("cancelled snapshot retains the client request id", () => {
  const runs = new RunCoordinator();
  runs.start({ requestId: "client-42" });
  assert.equal(runs.cancel().requestId, "client-42");
});

test("run kind distinguishes chat from image work", () => {
  const runs = new RunCoordinator();
  assert.equal(runs.start({ kind: "image", requestId: "image" }).kind, "image");
});

test("finish after cancellation is rejected", () => {
  const runs = new RunCoordinator();
  const run = runs.start({ requestId: "one" });
  runs.cancel();
  assert.equal(runs.finish(run), false);
});

test("attaching an empty server id remains valid", () => {
  const runs = new RunCoordinator();
  const run = runs.start({ requestId: "one" });
  assert.equal(runs.attachServerRunId(run, ""), true);
  assert.equal(runs.active.serverRunId, null);
});

test("each start advances the generation", () => {
  const runs = new RunCoordinator();
  const first = runs.start({ requestId: "one" });
  const second = runs.start({ requestId: "two" });
  assert.ok(second.generation > first.generation);
});

test("cancel advances generation to reject asynchronous callbacks", () => {
  const runs = new RunCoordinator();
  const run = runs.start({ requestId: "one" });
  runs.cancel();
  assert.ok(runs.generation > run.generation);
});

test("double cancel remains cancelled without throwing", () => {
  const runs = new RunCoordinator();
  runs.start({ requestId: "one" });
  assert.equal(runs.cancel().cancelled, true);
  assert.equal(runs.cancel().cancelled, true);
});

test("late server id after cancel is rejected", () => {
  const runs = new RunCoordinator();
  const run = runs.start({ requestId: "one" });
  runs.cancel();
  assert.equal(runs.attachServerRunId(run, "late-server"), false);
});

test("finishing leaves old run non-current", () => {
  const runs = new RunCoordinator();
  const run = runs.start({ requestId: "one" });
  runs.finish(run);
  assert.equal(runs.isCurrent(run), false);
});

test("new run after cancel is current", () => {
  const runs = new RunCoordinator();
  runs.start({ requestId: "old" });
  runs.cancel();
  const next = runs.start({ requestId: "next" });
  assert.equal(runs.isCurrent(next), true);
});

test("cancelled run preserves its controller for diagnostics", () => {
  const runs = new RunCoordinator();
  const controller = new AbortController();
  runs.start({ requestId: "one", controller });
  assert.equal(runs.cancel().controller, controller);
});
