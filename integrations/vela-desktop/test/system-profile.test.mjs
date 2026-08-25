import assert from "node:assert/strict";
import test from "node:test";

import { buildSystemProfile } from "../src/system-profile.mjs";

const GB = 1024 ** 3;

test("recommends an 8B model for a capable NVIDIA PC", () => {
  const profile = buildSystemProfile({
    platform: "win32", arch: "x64", totalMemoryBytes: 32 * GB, freeMemoryBytes: 20 * GB,
    freeDiskBytes: 100 * GB, gpus: [{ name: "NVIDIA RTX 4060", memoryGb: 8 }]
  });
  assert.equal(profile.accelerator, "cuda");
  assert.equal(profile.recommendations[0].id, "qwen3:8b");
  assert.equal(profile.recommendations[0].preferred, true);
});

test("recommends direct 4B on an Apple Silicon Mac", () => {
  const profile = buildSystemProfile({
    platform: "darwin", arch: "arm64", totalMemoryBytes: 16 * GB, freeMemoryBytes: 9 * GB,
    freeDiskBytes: 60 * GB, gpus: [{ name: "Apple M2", vendor: "apple" }]
  });
  assert.equal(profile.accelerator, "metal");
  assert.ok(profile.recommendations.some((item) => item.id === "qwen3-4b-q4"));
});

test("low memory falls back to API and explains the limitation", () => {
  const profile = buildSystemProfile({
    platform: "win32", arch: "x64", totalMemoryBytes: 6 * GB, freeMemoryBytes: 2 * GB,
    freeDiskBytes: 100 * GB, gpus: []
  });
  assert.equal(profile.recommendations[0].id, "api");
  assert.ok(profile.warnings.some((warning) => warning.code === "low-memory"));
});

test("offline and low disk conditions are explicit", () => {
  const profile = buildSystemProfile({
    platform: "win32", arch: "x64", totalMemoryBytes: 16 * GB, freeMemoryBytes: 8 * GB,
    freeDiskBytes: 5 * GB, gpus: [], online: false
  });
  assert.ok(profile.warnings.some((warning) => warning.code === "offline"));
  assert.ok(profile.warnings.some((warning) => warning.code === "low-disk"));
  assert.equal(profile.recommendations[0].id, "api");
});
