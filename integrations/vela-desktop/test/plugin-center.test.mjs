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
  assert.throws(() => installPlugin(path.join(root, "plugins.json"), "gmail"), /尚未交付/);
  const result = publicPluginCatalog({ plugins: {} });
  assert.equal(result.plugins.find((item) => item.id === "gmail").state.status, "unavailable");
  assert.ok(publicPluginCatalog({ plugins: {} }).plugins.length >= 16);
});

test("catalog reports whether a configured native plugin is active in the agent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vela-plugins-"));
  const file = path.join(root, "plugins.json");
  installPlugin(file, "web-search", "standard");
  const inactive = publicPluginCatalog(loadPluginConfig(file), { web_search: false });
  assert.equal(inactive.plugins.find((item) => item.id === "web-search").state.status, "restart_required");
  const active = publicPluginCatalog(loadPluginConfig(file), { web_search: true });
  assert.equal(active.plugins.find((item) => item.id === "web-search").state.runtimeActive, true);
});

test("computer control requires full access", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vela-plugins-"));
  assert.throws(() => installPlugin(path.join(root, "plugins.json"), "computer-control", "standard"), /完全访问/);
});
