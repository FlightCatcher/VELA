import assert from "node:assert/strict";
import test from "node:test";

import { isMissingSessionError } from "../src/session-recovery.mjs";

test("recognizes a stale server session", () => {
  assert.equal(isMissingSessionError(new Error("Session not found: stale-id")), true);
});

test("does not recover unrelated chat failures", () => {
  assert.equal(isMissingSessionError(new Error("Provider request timed out")), false);
  assert.equal(isMissingSessionError(null), false);
});
