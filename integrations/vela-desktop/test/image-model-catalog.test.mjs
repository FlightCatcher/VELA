import assert from "node:assert/strict";
import test from "node:test";

import { imageModelCatalog, imageModelInstallAssets } from "../src/image-model-catalog.mjs";

test("image model catalog exposes VELA image engines", () => {
  const catalog = imageModelCatalog();
  assert.deepEqual(catalog.map((item) => item.id), ["anime", "realistic", "ssd1b", "flux2"]);
  assert.ok(catalog.every((item) => Array.isArray(item.files) && item.files.length > 0));
});

test("one-click image model assets stay on the external model drive", () => {
  for (const asset of imageModelInstallAssets("anime")) {
    assert.match(asset.path, /^D:\\AI-Models-HotCache\\/);
    assert.match(asset.url, /^https:\/\/huggingface\.co\//);
  }
});

test("incomplete bundles cannot pretend to support one-click install", () => {
  assert.throws(() => imageModelInstallAssets("flux2"), /cannot be installed automatically/i);
});
