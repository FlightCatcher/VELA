import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadStorageConfig, saveStorageConfig } from "../src/storage-config.mjs";

test("storage configuration derives every large directory from one selected root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vela-storage-"));
  const configPath = path.join(root, "settings", "storage.json");
  const dataRoot = path.join(root, "external-drive", "VELA");
  const saved = saveStorageConfig(configPath, { dataRoot });
  const loaded = loadStorageConfig(configPath, path.join(root, "Documents"));
  assert.equal(loaded.dataRoot, path.resolve(dataRoot));
  assert.equal(saved.modelsRoot, path.join(path.resolve(dataRoot), "Models"));
  assert.equal(saved.outputRoot, path.join(path.resolve(dataRoot), "Outputs"));
});
