import fs from "node:fs";
import path from "node:path";

export const PLUGIN_CATALOG = Object.freeze([
  { id: "web-search", name: "网页搜索", category: "研究", description: "检索公开网页并返回来源。", permissions: ["network"], setup: "native" },
  { id: "browser", name: "浏览器", category: "电脑", description: "打开网页并读取页面状态。", permissions: ["network", "browser"], setup: "native" },
  { id: "computer-control", name: "电脑控制", category: "电脑", description: "控制窗口、鼠标和键盘；仅完全访问可用。", permissions: ["desktop_control"], setup: "native", requiresFullAccess: true },
  { id: "home-assistant", name: "Home Assistant", category: "生活", description: "连接本地智能家居。", permissions: ["network", "smart_home"], setup: "configuration" },
  ...[
    ["gmail", "Gmail", "邮件"], ["google-calendar", "Google Calendar", "日程"], ["google-drive", "Google Drive", "云盘"],
    ["outlook-email", "Outlook Email", "邮件"], ["outlook-calendar", "Outlook Calendar", "日程"], ["sharepoint", "SharePoint", "协作"],
    ["slack", "Slack", "沟通"], ["teams", "Microsoft Teams", "沟通"], ["notion", "Notion", "知识"], ["box", "Box", "云盘"],
    ["atlassian-rovo", "Atlassian Rovo", "协作"], ["figma", "Figma", "设计"]
  ].map(([id, name, category]) => ({ id, name, category, description: `连接 ${name} 账户。`, permissions: ["network", "account_data"], setup: "oauth" })),
  { id: "custom-mcp", name: "自定义 MCP", category: "开发", description: "接入兼容 MCP 的本地或远程工具服务。", permissions: ["tools"], setup: "configuration" }
]);

export function loadPluginConfig(configPath) {
  try { return normalizePluginConfig(JSON.parse(fs.readFileSync(configPath, "utf8"))); }
  catch { return { plugins: {} }; }
}

export function savePluginConfig(configPath, config) {
  const normalized = normalizePluginConfig(config);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export function installPlugin(configPath, pluginId, permissionProfile = "safe") {
  const plugin = PLUGIN_CATALOG.find((item) => item.id === pluginId);
  if (!plugin) throw new Error("未知插件。");
  if (plugin.requiresFullAccess && permissionProfile !== "full_access") throw new Error("此插件需要先启用完全访问。");
  const config = loadPluginConfig(configPath);
  config.plugins[plugin.id] = {
    enabled: plugin.setup === "native",
    status: plugin.setup === "native" ? "ready" : "needs_authorization",
    installedAt: new Date().toISOString()
  };
  savePluginConfig(configPath, config);
  return publicPluginCatalog(config);
}

export function uninstallPlugin(configPath, pluginId) {
  const config = loadPluginConfig(configPath);
  delete config.plugins[pluginId];
  savePluginConfig(configPath, config);
  return publicPluginCatalog(config);
}

export function publicPluginCatalog(config) {
  const normalized = normalizePluginConfig(config);
  return { plugins: PLUGIN_CATALOG.map((plugin) => ({ ...plugin, state: normalized.plugins[plugin.id] ?? { enabled: false, status: "available" } })) };
}

export function normalizePluginConfig(value) {
  const plugins = value?.plugins && typeof value.plugins === "object" && !Array.isArray(value.plugins) ? value.plugins : {};
  return { plugins: Object.fromEntries(Object.entries(plugins).filter(([, item]) => item && typeof item === "object")) };
}

export function pluginRuntimeEnvironment(config, permissionProfile) {
  const normalized = normalizePluginConfig(config);
  const ready = (id) => normalized.plugins[id]?.status === "ready";
  return {
    OCU_WEB_SEARCH_ENABLED: String(ready("web-search") && permissionProfile !== "safe"),
    OCU_DESKTOP_CONTROL_ENABLED: String(
      ready("computer-control") && permissionProfile === "full_access"
    )
  };
}
