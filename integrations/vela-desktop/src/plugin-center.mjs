import fs from "node:fs";
import path from "node:path";

export const PLUGIN_CATALOG = Object.freeze([
  { id: "web-search", name: "网页搜索", category: "研究", description: "检索并读取公开网页；安装后会验证 Agent 端工具是否真实加载。", permissions: ["network"], setup: "native", implemented: true, runtimeCapability: "web_search" },
  { id: "browser", name: "浏览器自动化", category: "电脑", description: "规划中：当前版本尚未提供页面视觉与交互后端。", permissions: ["network", "browser"], setup: "unavailable", implemented: false },
  { id: "computer-control", name: "电脑控制", category: "电脑", description: "截图、视觉分析、窗口、鼠标与键盘；仅完全访问可用。", permissions: ["desktop_control"], setup: "native", implemented: true, runtimeCapability: "desktop_control", requiresFullAccess: true },
  { id: "home-assistant", name: "Home Assistant", category: "生活", description: "规划中：账户配置界面和实体控制适配器尚未完成。", permissions: ["network", "smart_home"], setup: "unavailable", implemented: false },
  ...[
    ["gmail", "Gmail", "邮件"], ["google-calendar", "Google Calendar", "日程"], ["google-drive", "Google Drive", "云盘"],
    ["outlook-email", "Outlook Email", "邮件"], ["outlook-calendar", "Outlook Calendar", "日程"], ["sharepoint", "SharePoint", "协作"],
    ["slack", "Slack", "沟通"], ["teams", "Microsoft Teams", "沟通"], ["notion", "Notion", "知识"], ["box", "Box", "云盘"],
    ["atlassian-rovo", "Atlassian Rovo", "协作"], ["figma", "Figma", "设计"]
  ].map(([id, name, category]) => ({ id, name, category, description: `${name} 连接入口预留；OAuth 后端尚未随公测版交付。`, permissions: ["network", "account_data"], setup: "unavailable", implemented: false })),
  { id: "custom-mcp", name: "自定义 MCP", category: "开发", description: "规划中：配置编辑器尚未交付，可暂时通过 configs/mcp.json 接入。", permissions: ["tools"], setup: "unavailable", implemented: false }
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
  if (!plugin.implemented) throw new Error("此插件尚未交付真实后端，当前不能安装。");
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

export function publicPluginCatalog(config, runtimeCapabilities = null) {
  const normalized = normalizePluginConfig(config);
  return { plugins: PLUGIN_CATALOG.map((plugin) => {
    const stored = normalized.plugins[plugin.id];
    if (!plugin.implemented) return { ...plugin, state: { enabled: false, status: "unavailable", runtimeActive: false } };
    const runtimeActive = plugin.runtimeCapability && runtimeCapabilities
      ? runtimeCapabilities[plugin.runtimeCapability] === true
      : null;
    const status = stored?.status === "ready" && runtimeActive === false ? "restart_required" : (stored?.status ?? "available");
    return { ...plugin, state: { ...(stored ?? { enabled: false }), status, runtimeActive } };
  }) };
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
