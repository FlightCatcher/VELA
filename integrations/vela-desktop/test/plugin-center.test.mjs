import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { installPlugin, loadPluginConfig, pluginRuntimeEnvironment, publicPluginCatalog, uninstallPlugin } from "../src/plugin-center.mjs";

test("native plugin installs in one step", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vela-plugins-"));
  const file = path.join(root, "plugins.json");
  const installed = installPlugin(file, "web-search");
  assert.equal(installed.plugins.find((item) => item.id === "web-search").state.status, "ready");
  assert.equal(pluginRuntimeEnvironment(loadPluginConfig(file), "standard").OCU_WEB_SEARCH_ENABLED, "true");
  uninstallPlugin(file, "web-search");
  assert.equal(loadPluginConfig(file).plugins["web-search"], undefined);
});

test("account connector reports authorization instead of claiming success", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vela-plugins-"));
  const result = installPlugin(path.join(root, "plugins.json"), "gmail");
  assert.equal(result.plugins.find((item) => item.id === "gmail").state.status, "needs_authorization");
  assert.ok(publicPluginCatalog({ plugins: {} }).plugins.length >= 16);
});

test("computer control requires full access", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vela-plugins-"));
  assert.throws(() => installPlugin(path.join(root, "plugins.json"), "computer-control", "standard"), /完全访问/);
});
