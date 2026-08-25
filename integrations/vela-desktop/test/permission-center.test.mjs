import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FULL_ACCESS_CONFIRMATION, loadPermissionConfig, permissionRuntimeEnvironment, savePermissionConfig } from "../src/permission-center.mjs";

test("permission center defaults to safe mode", () => {
  assert.equal(loadPermissionConfig(path.join(os.tmpdir(), "vela-missing-permissions.json")).profile, "safe");
});

test("full access requires explicit risk phrase and changes runtime environment", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vela-permissions-"));
  const file = path.join(root, "permissions.json");
  assert.throws(() => savePermissionConfig(file, { profile: "full_access" }), /完全访问/);
  const config = savePermissionConfig(file, { profile: "full_access" }, FULL_ACCESS_CONFIRMATION);
  const env = permissionRuntimeEnvironment(config, root);
  assert.equal(env.OCU_ENABLE_SHELL_TOOL, "true");
  assert.equal(env.OCU_SHELL_ALLOW_ALL_COMMANDS, "true");
  assert.equal(env.OCU_WORKSPACE_ALLOW_ABSOLUTE_PATHS, "true");
});
