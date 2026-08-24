import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildLlamaServerArgs,
  directModelId,
  discoverGgufModels
} from "../src/direct-model-runtime.mjs";

test("discovers GGUF models without descending forever", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vela-gguf-"));
  const nested = path.join(root, "models");
  fs.mkdirSync(nested);
  fs.writeFileSync(path.join(nested, "tiny.gguf"), "gguf");
  fs.writeFileSync(path.join(nested, "ignore.bin"), "no");
  const models = discoverGgufModels([root]);
  assert.equal(models.length, 1);
  assert.equal(models[0].label, "tiny");
  fs.rmSync(root, { recursive: true, force: true });
});

test("direct model ids remain stable and paths are passed as one argument", () => {
  const modelPath = "E:\\AI Models\\Qwen 4B.gguf";
  const id = directModelId(modelPath);
  assert.match(id, /^qwen-4b-[a-f0-9]{8}$/);
  const args = buildLlamaServerArgs({ id, modelPath, contextSize: 2048, gpuLayers: 40 });
  assert.equal(args[1], modelPath);
  assert.equal(args[args.indexOf("--parallel") + 1], "1");
});
