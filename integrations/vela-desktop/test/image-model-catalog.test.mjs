import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { imageModelCatalog, imageModelInstallAssets } from "../src/image-model-catalog.mjs";

test("image model catalog exposes VELA image engines", () => {
  const catalog = imageModelCatalog("D:\\VELA\\Models");
  assert.deepEqual(catalog.map((item) => item.id), ["anime", "realistic", "ssd1b", "flux2"]);
  assert.ok(catalog.every((item) => Array.isArray(item.files) && item.files.length > 0));
});

test("one-click image model assets stay on the external model drive", () => {
  const modelsRoot = path.join(os.tmpdir(), "VELA", "Models");
  for (const asset of imageModelInstallAssets("anime", modelsRoot)) {
    const relative = path.relative(modelsRoot, asset.path);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    assert.match(asset.url, /^https:\/\/huggingface\.co\//);
  }
});

test("incomplete bundles cannot pretend to support one-click install", () => {
  assert.throws(() => imageModelInstallAssets("flux2", "D:\\VELA\\Models"), /cannot be installed automatically/i);
});
