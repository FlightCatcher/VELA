import fs from "node:fs";
import path from "node:path";

export const FULL_ACCESS_CONFIRMATION = "我了解完全访问风险";

export const PERMISSION_PROFILES = Object.freeze({
  safe: {
    id: "safe",
    name: "安全模式",
    description: "仅可读取当前工作区；命令、桌面控制和外部写入均关闭。",
    risk: "low",
    capabilities: { workspaceRead: true, workspaceWrite: false, shell: false, unrestrictedShell: false, web: false, desktopControl: false, externalWrite: false }
  },
  standard: {
    id: "standard",
    name: "标准模式",
    description: "允许联网和受控命令；写入与高风险操作仍需逐次确认。",
    risk: "medium",
    capabilities: { workspaceRead: true, workspaceWrite: true, shell: true, unrestrictedShell: false, web: true, desktopControl: false, externalWrite: false }
  },
  full_access: {
    id: "full_access",
    name: "完全访问",
    description: "允许访问任意本地路径、执行任意程序并启用桌面控制插件。",
    risk: "critical",
    capabilities: { workspaceRead: true, workspaceWrite: true, shell: true, unrestrictedShell: true, web: true, desktopControl: true, externalWrite: true }
  }
});

const DEFAULT_CONFIG = Object.freeze({ profile: "safe", updatedAt: null });

export function loadPermissionConfig(configPath) {
  try {
    return normalizePermissionConfig(JSON.parse(fs.readFileSync(configPath, "utf8")));
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function savePermissionConfig(configPath, value, confirmation = "") {
  const next = normalizePermissionConfig(value);
  if (next.profile === "full_access" && confirmation.trim() !== FULL_ACCESS_CONFIRMATION) {
    throw new Error(`启用完全访问前，请输入“${FULL_ACCESS_CONFIRMATION}”。`);
  }
  next.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export function publicPermissionConfig(config) {
  const normalized = normalizePermissionConfig(config);
  return {
    ...normalized,
    active: PERMISSION_PROFILES[normalized.profile],
    profiles: Object.values(PERMISSION_PROFILES),
    fullAccessConfirmation: FULL_ACCESS_CONFIRMATION,
    warnings: [
      "完全访问可读取或修改任意本地文件，并可启动外部程序。",
      "恶意网页、文档或插件可能诱导 Agent 执行危险操作。",
      "请只安装可信插件；不需要时立即切回安全模式。"
    ]
  };
}

export function permissionRuntimeEnvironment(config, workspaceRoot) {
  const profile = PERMISSION_PROFILES[normalizePermissionConfig(config).profile];
  return {
    OCU_PERMISSION_PROFILE: profile.id,
    OCU_ENABLE_SHELL_TOOL: String(profile.capabilities.shell),
    OCU_SHELL_ALLOW_ALL_COMMANDS: String(profile.capabilities.unrestrictedShell),
    OCU_WORKSPACE_ALLOW_ABSOLUTE_PATHS: String(profile.id === "full_access"),
    OCU_WEB_SEARCH_ENABLED: String(profile.capabilities.web),
    OCU_DESKTOP_CONTROL_ENABLED: String(profile.capabilities.desktopControl),
    OCU_WORKSPACE_ROOT: workspaceRoot
  };
}

export function normalizePermissionConfig(value) {
  const profile = String(value?.profile || "safe");
  return {
    profile: Object.hasOwn(PERMISSION_PROFILES, profile) ? profile : "safe",
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : null
  };
}
