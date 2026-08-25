import assert from "node:assert/strict";
import test from "node:test";

import { runWithDeadline } from "../src/async-deadline.mjs";

test("returns the operation result before its deadline", async () => {
  const result = await runWithDeadline(async () => "ready", 100, "fallback");
  assert.equal(result, "ready");
});

test("returns the fallback when an operation ignores cancellation", async () => {
  const startedAt = Date.now();
  const result = await runWithDeadline(
    () => new Promise(() => {}),
    20,
    "original prompt"
  );
  assert.equal(result, "original prompt");
  assert.ok(Date.now() - startedAt < 250);
});

test("aborts the operation when its deadline expires", async () => {
  let aborted = false;
  await runWithDeadline(
    (signal) => new Promise((resolve) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        resolve("late");
      });
    }),
    20,
    "fallback"
  );
  assert.equal(aborted, true);
});
