import assert from "node:assert/strict";
import test from "node:test";

import { clampImageProgress, messageListRenderKey } from "../renderer/message-render-state.js";

test("thinking phase changes do not invalidate the full message list", () => {
  const base = {
    language: "zh",
    pending: true,
    activeImageRun: false,
    sessionKey: "session-1",
    messages: [{ role: "user", text: "hello" }]
  };
  assert.equal(messageListRenderKey({ ...base, thinkingPhase: 0 }), messageListRenderKey({ ...base, thinkingPhase: 3 }));
});

test("image progress changes do not invalidate the full message list", () => {
  const base = {
    language: "zh",
    pending: true,
    activeImageRun: true,
    sessionKey: "session-1",
    messages: [{ role: "user", text: "draw" }]
  };
  assert.equal(messageListRenderKey({ ...base, imageProgress: 2 }), messageListRenderKey({ ...base, imageProgress: 88 }));
});

test("pending mode still changes the structural render key", () => {
  const base = { language: "zh", pending: true, sessionKey: "session-1", messages: [] };
  assert.notEqual(
    messageListRenderKey({ ...base, activeImageRun: false }),
    messageListRenderKey({ ...base, activeImageRun: true })
  );
});

test("image progress is bounded for the progress presentation", () => {
  assert.equal(clampImageProgress(-5), 1);
  assert.equal(clampImageProgress(51.6), 52);
  assert.equal(clampImageProgress(120), 99);
});
