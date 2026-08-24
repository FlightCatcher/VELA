import { marked } from "/deps/marked.js";
import createDOMPurify from "/deps/purify.js";
import { latestMessageByRole } from "./history.js";
import { messageExecutionRoute } from "./intents.js";
import { resolveMediaUrl } from "./media.js";
import { RunCoordinator } from "./run-control.js";

const DOMPurify = createDOMPurify(window);
marked.setOptions({ breaks: true, gfm: true });

const translations = {
  zh: {
    analyzeFile: "分析文件",
    analyzeFileHint: "图片、文档或音视频",
    attach: "文件",
    connected: "已连接",
    healthChecking: "本地服务检查中",
    healthReady: "VELA 2.3 · 就绪",
    healthDegraded: "VELA 2.3 · 部分服务离线",
    healthMemory: "内存压力较高",
    connecting: "正在连接",
    disconnected: "连接中断",
    dropFiles: "释放以上传文件",
    fileAdded: "文件已添加",
    fileLimit: "最多添加 8 个文件，每个不超过 25 MB",
    generateImage: "生成图片",
    generateImageHint: "使用 VELA 本地原生引擎",
    imageMode: "生图",
    imageModeActive: "生图模式已开启",
    imageAspect: "画幅",
    imageQuality: "质量",
    imageStudioHint: "按题材选择模型，角色可启用参考锁定",
    imageSubjects: "适合题材",
    imageEngine: "引擎",
    engineAnime: "动漫角色",
    engineFast: "极速 SDXL",
    engineFlux: "FLUX.2 参考",
    engineRealistic: "写实摄影",
    imageStudioTitle: "图像工作室",
    imageReference: "角色参考",
    imageStyle: "质感",
    localAgent: "本地智能体",
    localPrivate: "本地 · 私密",
    messagePlaceholder: "给 VELA 发消息",
    modelLabel: "模型",
    modelNote: "当前模型 · VELA 独立执行引擎",
    modelLoading: "正在读取模型",
    modelSwitching: "正在切换模型…",
    modelSwitched: "模型已切换",
    modelSwitchFailed: "模型切换失败",
    themeLight: "切换到白天模式",
    themeDark: "切换到黑夜模式",
    themeDay: "白天",
    themeNight: "黑夜",
    controlCenter: "智能体控制中心",
    workspaceSyncing: "同步中",
    workspaceSynced: "已同步",
    workspaceOffline: "本地 API 离线",
    workspaceRefresh: "刷新",
    workspaceEmpty: "还没有已保存的计划",
    workspaceSelectPlan: "选择一个计划查看步骤、结果和失败诊断",
    workspaceStatus: "状态",
    workspaceSteps: "步骤",
    workspaceUpdated: "更新时间",
    workspaceNoDetail: "暂无执行详情",
    statusOnline: "在线",
    statusOffline: "离线",
    statusReady: "就绪",
    statusRunning: "运行中",
    statusCompleted: "已完成",
    statusFailed: "失败",
    statusPending: "等待",
    reflectionTitle: "Reflection 诊断",
    reflectionRetryable: "可恢复",
    reflectionSuggested: "建议",
    workspaceNav: "工作区",
    workspaceChat: "对话",
    workspaceTasks: "任务",
    workspacePlans: "计划",
    workspaceRuns: "运行",
    workspaceModels: "模型",
    workspaceTools: "工具",
    workspaceLive: "实时工作区",
    workspaceOpen: "展开可视化",
    workspaceClose: "收起可视化",
    flowIntent: "理解",
    flowPlan: "规划",
    flowExecute: "执行",
    flowVerify: "验证",
    metricSession: "会话",
    metricHistory: "消息",
    metricMode: "模式",
    metricReady: "就绪",
    metricWorking: "工作中",
    metricImage: "生图",
    newChat: "新对话",
    noText: "附件",
    openWeb: "联网研究",
    openWebHint: "搜索、整理与创作",
    recents: "最近",
    reconnect: "重新连接",
    sendFailed: "发送失败",
    sendHint: "Enter 发送",
    qualityHigh: "推荐 · 2K",
    qualityStandard: "快速 · HD",
    qualityUltra: "极致 · 4K",
    referenceHint: "上传参考图可锁定脸型、发型和服装；严格模式优先保留身份",
    textFidelity: "文字清晰",
    textAuto: "智能",
    textClear: "清晰排版",
    textNone: "无文字",
    progressPreparing: "正在理解你的需求",
    progressSemantic: "正在提取主体、场景与动作",
    progressDetail: "正在补全合理画面细节",
    progressComposition: "正在设计镜头与构图",
    progressStyle: "正在融合风格、光影与色彩",
    progressConsistency: "正在检查画面设定冲突",
    progressRouting: "正在搜索资料并选择专用模型",
    progressQueued: "已进入生成队列",
    progressGenerating: "VELA 正在本地生成",
    progressChecking: "生成完成，正在显示图片",
    progressOffline: "本地生图引擎未连接",
    progressEstimate: "预计进度",
    referenceOff: "关闭",
    referenceSmart: "自动学习",
    referenceStrict: "严格还原",
    styleAnime: "动漫",
    styleAuto: "智能",
    styleCinematic: "电影",
    styleIllustration: "插画",
    styleNatural: "自然",
    stylePhoto: "摄影",
    styleProduct: "产品",
    subtitle: "可聊天、看图、读文件，也可以直接在对话中生成图片。",
    thinking: "VELA 正在处理",
    thinkingUnderstand: "正在理解任务",
    thinkingPlan: "正在规划步骤",
    thinkingExecute: "正在执行任务",
    thinkingVerify: "正在核对结果",
    title: "今天想让 VELA 做什么？",
    untitled: "新对话"
  },
  en: {
    analyzeFile: "Analyze files",
    analyzeFileHint: "Images, docs, audio or video",
    attach: "Attach",
    connected: "Connected",
    healthChecking: "Checking local services",
    healthReady: "VELA 2.3 · Ready",
    healthDegraded: "VELA 2.3 · Degraded",
    healthMemory: "High memory pressure",
    connecting: "Connecting",
    disconnected: "Disconnected",
    dropFiles: "Drop files to upload",
    fileAdded: "File added",
    fileLimit: "Up to 8 files, 25 MB each",
    generateImage: "Create an image",
    generateImageHint: "Powered by VELA Native Engine",
    imageMode: "Image",
    imageModeActive: "Image mode enabled",
    imageAspect: "Canvas",
    imageQuality: "Quality",
    imageStudioHint: "Choose an engine by subject; lock identity with a reference",
    imageSubjects: "Best for",
    imageEngine: "Engine",
    engineAnime: "Anime character",
    engineFast: "Fast SDXL",
    engineFlux: "FLUX.2 reference",
    engineRealistic: "Realistic photo",
    imageStudioTitle: "Image Studio",
    imageReference: "Character reference",
    imageStyle: "Texture",
    localAgent: "Local agent",
    localPrivate: "Local · Private",
    messagePlaceholder: "Message VELA",
    modelLabel: "Model",
    modelNote: "Current model · VELA independent runtime",
    modelLoading: "Loading models",
    modelSwitching: "Switching model…",
    modelSwitched: "Model switched",
    modelSwitchFailed: "Could not switch model",
    themeLight: "Switch to light mode",
    themeDark: "Switch to dark mode",
    themeDay: "Light",
    themeNight: "Dark",
    controlCenter: "AGENT CONTROL CENTER",
    workspaceSyncing: "Syncing",
    workspaceSynced: "Synced",
    workspaceOffline: "Local API offline",
    workspaceRefresh: "Refresh",
    workspaceEmpty: "No saved plans yet",
    workspaceSelectPlan: "Select a plan to inspect steps, results and failures",
    workspaceStatus: "Status",
    workspaceSteps: "Steps",
    workspaceUpdated: "Updated",
    workspaceNoDetail: "No execution detail yet",
    statusOnline: "Online",
    statusOffline: "Offline",
    statusReady: "Ready",
    statusRunning: "Running",
    statusCompleted: "Completed",
    statusFailed: "Failed",
    statusPending: "Pending",
    reflectionTitle: "Reflection diagnosis",
    reflectionRetryable: "Retryable",
    reflectionSuggested: "Suggested action",
    workspaceNav: "Workspace",
    workspaceChat: "Chat",
    workspaceTasks: "Tasks",
    workspacePlans: "Plans",
    workspaceRuns: "Runs",
    workspaceModels: "Models",
    workspaceTools: "Tools",
    workspaceLive: "Live workspace",
    workspaceOpen: "Open visualizer",
    workspaceClose: "Close visualizer",
    flowIntent: "Understand",
    flowPlan: "Plan",
    flowExecute: "Execute",
    flowVerify: "Verify",
    metricSession: "Session",
    metricHistory: "Messages",
    metricMode: "Mode",
    metricReady: "Ready",
    metricWorking: "Working",
    metricImage: "Image",
    newChat: "New chat",
    noText: "Attachment",
    openWeb: "Research the web",
    openWebHint: "Search, synthesize and create",
    recents: "Recent",
    reconnect: "Reconnect",
    sendFailed: "Could not send",
    sendHint: "Enter to send",
    qualityHigh: "Recommended · 2K",
    qualityStandard: "Fast · HD",
    qualityUltra: "Ultra · 4K",
    referenceHint: "Attach a reference to lock face, hair and outfit; strict mode favors identity",
    textFidelity: "Text fidelity",
    textAuto: "Auto",
    textClear: "Clear layout",
    textNone: "No text",
    progressPreparing: "Understanding your request",
    progressSemantic: "Extracting subject, scene and action",
    progressDetail: "Completing coherent visual details",
    progressComposition: "Designing camera and composition",
    progressStyle: "Blending style, light and color",
    progressConsistency: "Checking visual consistency",
    progressRouting: "Researching and selecting a specialist model",
    progressQueued: "Queued for generation",
    progressGenerating: "VELA is generating locally",
    progressChecking: "Generated; displaying the image",
    progressOffline: "Local image engine is offline",
    progressEstimate: "Estimated progress",
    referenceOff: "Off",
    referenceSmart: "Learn automatically",
    referenceStrict: "Strict identity",
    styleAnime: "Anime",
    styleAuto: "Auto",
    styleCinematic: "Cinema",
    styleIllustration: "Illustration",
    styleNatural: "Natural",
    stylePhoto: "Photo",
    styleProduct: "Product",
    subtitle: "Chat, understand files and images, or create images directly in the conversation.",
    thinking: "VELA is working",
    thinkingUnderstand: "Understanding the task",
    thinkingPlan: "Planning the steps",
    thinkingExecute: "Executing the task",
    thinkingVerify: "Verifying the result",
    title: "What should VELA do today?",
    untitled: "New chat"
  }
};

const els = {
  app: document.querySelector("#app"),
  attachButton: document.querySelector("#attach-button"),
  attachmentStrip: document.querySelector("#attachment-strip"),
  chatContent: document.querySelector("#chat-content"),
  chatScroll: document.querySelector("#chat-scroll"),
  chatTitle: document.querySelector("#chat-title"),
  composer: document.querySelector("#composer"),
  composerInput: document.querySelector("#composer-input"),
  connectionLabel: document.querySelector("#connection-label"),
  connectionPill: document.querySelector("#connection-pill"),
  dropOverlay: document.querySelector("#drop-overlay"),
  fileInput: document.querySelector("#file-input"),
  imageModeButton: document.querySelector("#image-mode-button"),
  imageStudio: document.querySelector("#image-studio"),
  languageButton: document.querySelector("#language-button"),
  languageLabel: document.querySelector("#language-label"),
  mediaClose: document.querySelector("#media-close"),
  mediaDialog: document.querySelector("#media-dialog"),
  mediaDialogImage: document.querySelector("#media-dialog-image"),
  onboardingDialog: document.querySelector("#onboarding-dialog"),
  onboardingStorage: document.querySelector("#onboarding-storage"),
  onboardingModels: document.querySelector("#onboarding-models"),
  onboardingFinish: document.querySelector("#onboarding-finish"),
  onboardingSkip: document.querySelector("#onboarding-skip"),
  modelSelect: document.querySelector("#model-select"),
  modelCenterButton: document.querySelector("#model-center-button"),
  modelCenterDialog: document.querySelector("#model-center-dialog"),
  modelCenterClose: document.querySelector("#model-center-close"),
  recommendedModels: document.querySelector("#recommended-models"),
  directModels: document.querySelector("#direct-models"),
  imageModels: document.querySelector("#image-models"),
  modelCenterSummary: document.querySelector("#model-center-summary"),
  modelStoragePath: document.querySelector("#model-storage-path"),
  modelStorageSelect: document.querySelector("#model-storage-select"),
  appUpdateButton: document.querySelector("#app-update-button"),
  directRuntimeInstall: document.querySelector("#direct-runtime-install"),
  imageRuntimeInstall: document.querySelector("#image-runtime-install"),
  providerForm: document.querySelector("#provider-form"),
  providerTemplate: document.querySelector("#provider-template"),
  providerLabel: document.querySelector("#provider-label"),
  providerBaseUrl: document.querySelector("#provider-base-url"),
  providerModel: document.querySelector("#provider-model"),
  providerApiKey: document.querySelector("#provider-api-key"),
  commandDeck: document.querySelector("#command-deck"),
  workspaceToggle: document.querySelector("#workspace-toggle"),
  deckStatus: document.querySelector("#deck-status"),
  deckMode: document.querySelector("#deck-mode"),
  deckSession: document.querySelector("#deck-session"),
  deckHistory: document.querySelector("#deck-history"),
  healthBadge: document.querySelector("#health-badge"),
  newChatButton: document.querySelector("#new-chat-button"),
  retryButton: document.querySelector("#retry-button"),
  sendButton: document.querySelector("#send-button"),
  sessionList: document.querySelector("#session-list"),
  sidebar: document.querySelector("#sidebar"),
  sidebarButton: document.querySelector("#sidebar-button"),
  stopButton: document.querySelector("#stop-button"),
  themeButton: document.querySelector("#theme-button"),
  workspaceNav: document.querySelector("#workspace-nav"),
  workspacePanel: document.querySelector("#workspace-panel"),
  workspacePanelTitle: document.querySelector("#workspace-panel-title"),
  workspacePanelSync: document.querySelector("#workspace-panel-sync"),
  workspacePanelRefresh: document.querySelector("#workspace-panel-refresh"),
  workspacePanelMetrics: document.querySelector("#workspace-panel-metrics"),
  workspacePanelList: document.querySelector("#workspace-panel-list"),
  workspacePanelDetail: document.querySelector("#workspace-panel-detail"),
  toastRegion: document.querySelector("#toast-region")
};

const query = new URLSearchParams(location.search);
const appKey = query.get("appKey") ?? "";
history.replaceState({}, "", "/");

const defaultSession = {
  key: "agent:main:openclaw-desktop",
  title: translations.zh.untitled,
  updatedAt: Date.now()
};

const defaultImageSettings = {
  routingVersion: 2,
  aspect: "landscape",
  engine: "auto",
  quality: "high",
  reference: "smart",
  memory: "remember",
  style: "auto",
  textMode: "auto"
};

const state = {
  activeRunId: null,
  activeUserText: "",
  attachments: [],
  bootstrap: null,
  client: null,
  connected: false,
  history: [],
  historySignature: "",
  imageMode: false,
  activeImageRun: false,
  cancelledTurn: null,
  imageProgress: { value: 0, stage: "", detail: "" },
  imageQueueSeen: false,
  imageStartedAt: 0,
  imageStatusTimer: null,
  healthTimer: null,
  health: { loading: true, ok: false, services: {}, resources: null },
  imageSettings: loadImageSettings(),
  models: { primary: "", items: [] },
  language: (localStorage.getItem("vela.desktop.language") ?? localStorage.getItem("openclaw.desktop.language")) === "en" ? "en" : "zh",
  optimistic: null,
  pending: false,
  thinkingPhase: 0,
  thinkingTimer: null,
  pollTimer: null,
  refreshForceScroll: false,
  refreshInFlight: false,
  refreshQueued: false,
  refreshTimer: null,
  renderedMessagesKey: "",
  sessions: loadSessions(),
  localImageMessages: loadLocalImageMessages(),
  theme: loadTheme(),
  workspaceView: "chat",
  workspaceData: {
    loading: false,
    error: "",
    status: null,
    plans: [],
    selectedPlanId: "",
    detail: null
  },
  workspaceRefreshTimer: null
};

const runCoordinator = new RunCoordinator();

function loadTheme() {
  const saved = localStorage.getItem("vela.desktop.theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

let currentSessionKey =
  localStorage.getItem("vela.desktop.currentSession") ??
  localStorage.getItem("openclaw.desktop.currentSession") ??
  state.sessions[0]?.key ??
  defaultSession.key;

function t(key) {
  return translations[state.language][key] ?? key;
}

function loadImageSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem("vela.desktop.imageSettings") ?? localStorage.getItem("openclaw.desktop.imageSettings") ?? "{}");
    const migrationKey = "vela.desktop.imageWorkflowV1";
    const migrated = localStorage.getItem(migrationKey) === "1";
    const migratedEngine = migrated ? parsed.engine : "auto";
    if (!migrated) localStorage.setItem(migrationKey, "1");
    return {
      routingVersion: 2,
      aspect: ["square", "landscape", "portrait", "classic", "vertical", "photo"].includes(parsed.aspect)
        ? parsed.aspect
        : defaultImageSettings.aspect,
      engine: ["auto", "anime", "ssd1b", "flux2", "realistic"].includes(migratedEngine) ? migratedEngine : defaultImageSettings.engine,
      quality: ["standard", "high", "ultra"].includes(parsed.quality)
        ? parsed.quality
        : defaultImageSettings.quality,
      reference: ["smart", "strict", "off"].includes(parsed.reference)
        ? parsed.reference
        : defaultImageSettings.reference,
      memory: ["remember", "once"].includes(parsed.memory) ? parsed.memory : defaultImageSettings.memory,
      style: ["auto", "natural", "cinematic", "photo", "anime", "illustration", "product"].includes(parsed.style)
        ? parsed.style
        : defaultImageSettings.style,
      textMode: ["auto", "clear", "none"].includes(parsed.textMode)
        ? parsed.textMode
        : defaultImageSettings.textMode
    };
  } catch {
    return { ...defaultImageSettings };
  }
}

function loadLocalImageMessages() {
  try {
    const parsed = JSON.parse(localStorage.getItem("vela.desktop.imageMessages") ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalImageMessages() {
  const entries = Object.fromEntries(
    Object.entries(state.localImageMessages).map(([key, messages]) => [
      key,
      Array.isArray(messages) ? messages.slice(-20) : []
    ])
  );
  localStorage.setItem("vela.desktop.imageMessages", JSON.stringify(entries));
}

function localMessagesForSession(sessionKey = currentSessionKey) {
  return Array.isArray(state.localImageMessages[sessionKey]) ? state.localImageMessages[sessionKey] : [];
}

function saveLocalImageMessage(message, sessionKey = currentSessionKey) {
  const messages = localMessagesForSession(sessionKey);
  const signature = `${message?.imageRunId ?? ""}:${message?.content ?? ""}`;
  if (!messages.some((item) => `${item?.imageRunId ?? ""}:${item?.content ?? ""}` === signature)) {
    messages.push(message);
  }
  state.localImageMessages[sessionKey] = messages.slice(-20);
  saveLocalImageMessages();
}

function saveImageSettings() {
  localStorage.setItem("vela.desktop.imageSettings", JSON.stringify(state.imageSettings));
}

function loadSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem("vela.desktop.sessions") ?? localStorage.getItem("openclaw.desktop.sessions") ?? "[]");
    if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, 30);
  } catch {
    // Ignore malformed local state.
  }
  return [defaultSession];
}

function saveSessions() {
  state.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  localStorage.setItem("vela.desktop.sessions", JSON.stringify(state.sessions.slice(0, 30)));
  localStorage.setItem("vela.desktop.currentSession", currentSessionKey);
}

function currentSession() {
  return state.sessions.find((session) => session.key === currentSessionKey) ?? state.sessions[0];
}

function updateCurrentSession(patch) {
  const existing = currentSession();
  if (existing) {
    Object.assign(existing, patch);
  } else {
    state.sessions.unshift({ key: currentSessionKey, title: t("untitled"), updatedAt: Date.now(), ...patch });
  }
  saveSessions();
  renderSessions();
  renderHeader();
}

async function newSession() {
  if (state.pending) await abortRun();
  const created = state.connected
      ? await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Vela-App-Key": appKey },
        body: JSON.stringify({ title: t("untitled") })
      }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "无法创建会话");
        return payload;
      })
    : { id: crypto.randomUUID(), title: t("untitled"), updated_at: new Date().toISOString() };
  const key = created.id;
  state.sessions.unshift({ key, title: created.title, updatedAt: Date.parse(created.updated_at) || Date.now() });
  currentSessionKey = key;
  state.history = [];
  state.optimistic = null;
  state.pending = false;
  state.activeRunId = null;
  saveSessions();
  renderAll(true);
  if (state.connected) void refreshHistory(true);
  requestAnimationFrame(() => els.composerInput.focus());
}

async function deleteSession(key) {
  const target = state.sessions.find((session) => session.key === key);
  if (!target) return;
  const confirmed = window.confirm(
    state.language === "zh"
      ? `删除“${target.title || t("untitled")}”？此操作会从 VELA 的本地会话列表移除。`
      : `Delete “${target.title || t("untitled")}” from VELA?`
  );
  if (!confirmed) return;
  if (currentSessionKey === key && state.pending) await abortRun();

  if (state.connected) {
    await fetch(`/api/sessions/${encodeURIComponent(key)}/delete`, {
      method: "DELETE",
      headers: { "X-Vela-App-Key": appKey }
    }).catch(() => {});
  }

  state.sessions = state.sessions.filter((session) => session.key !== key);
  delete state.localImageMessages[key];
  const needsReplacement = currentSessionKey === key || !state.sessions.length;
  if (needsReplacement) {
    currentSessionKey = state.sessions[0]?.key ?? crypto.randomUUID();
    state.history = [];
    state.optimistic = null;
    state.pending = false;
    state.activeRunId = null;
  }
  saveLocalImageMessages();
  saveSessions();
  renderAll(true);
  if (needsReplacement && state.connected && !state.sessions.length) await newSession();
  else if (state.connected) void refreshHistory(true);
}

async function setSession(key) {
  if (key === currentSessionKey) return;
  if (state.pending) await abortRun();
  currentSessionKey = key;
  state.history = [];
  state.optimistic = null;
  state.pending = false;
  state.activeRunId = null;
  saveSessions();
  renderAll(true);
  if (state.connected) void refreshHistory(true);
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(state.language === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMarkdown(text) {
  const html = marked.parse(text ?? "");
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["target", "rel"],
    FORBID_TAGS: ["iframe", "object", "embed", "form", "input", "button", "style"]
  });
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n\n");
}

function cleanUserText(text) {
  const studioPrompt = text.match(
    /OPENCLAW_IMAGE_STUDIO_V2[\s\S]*?PROMPT_BEGIN\r?\n([\s\S]*?)\r?\nPROMPT_END/i
  );
  if (studioPrompt) return studioPrompt[1].trim();
  return text
    .replace(
      /^(?:请使用本地生图工具生成并在当前聊天中返回图片：|Use the local image-generation tool and return the image in this chat:)\s*/i,
      ""
    )
    .trim();
}

function isHiddenMessage(message) {
  const role = message?.role;
  if (role !== "user" && role !== "assistant") return true;
  if (message?.provenance?.kind === "inter_session") return true;
  const text = contentText(message?.content);
  if (text.includes("<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>>")) return true;
  if (role === "user" && /^A background task completed\./.test(text)) return true;
  return false;
}

function normalizeHistoryMessage(entry) {
  if (entry?.type === "message" && entry?.message) return entry.message;
  return entry;
}

function normalizePath(value) {
  return String(value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/[)\]}>,.;]+$/g, "");
}

function mediaUrl(value) {
  return resolveMediaUrl(value, { appKey });
}

function mediaKind(value, mimeType = "") {
  const source = `${value} ${mimeType}`.toLowerCase();
  if (/\.(?:png|jpe?g|webp|gif|bmp)(?:$|[?#\s])/.test(source) || mimeType.startsWith("image/") || /\/view(?:\?|$)/.test(source)) return "image";
  if (/\.(?:mp4|webm)(?:$|[?#\s])/.test(source) || mimeType.startsWith("video/")) return "video";
  if (/\.(?:mp3|wav)(?:$|[?#\s])/.test(source) || mimeType.startsWith("audio/")) return "audio";
  return "file";
}

function extractMessageParts(message) {
  let text = contentText(message?.content);
  if (message?.role === "user") text = cleanUserText(text);
  const media = [];
  const files = [];
  const seen = new Set();
  const hasMediaDirective = /(?:^|\n)\s*MEDIA:\s*(?:[A-Za-z]:|\/)/i.test(text);
  const hasNativeImage =
    hasMediaDirective
    ||
    (Array.isArray(message?.content)
      && message.content.some((block) => block?.type === "image"))
    || (typeof message?.mediaUrl === "string" && mediaKind(message.mediaUrl) === "image")
    || (Array.isArray(message?.mediaUrls)
      && message.mediaUrls.some((value) => mediaKind(value) === "image"));

  const add = (raw, mimeType = "", label = "") => {
    const value = normalizePath(raw);
    if (!value || seen.has(value)) return;
    seen.add(value);
    const kind = mediaKind(value, mimeType);
    const item = { kind, label: label || value.split(/[\\/]/).pop() || t("noText"), mimeType, raw: value, src: mediaUrl(value) };
    if (kind === "image" || kind === "video" || kind === "audio") media.push(item);
    else files.push(item);
  };

  const mediaLinePattern = /(?:^|\n)\s*MEDIA:\s*((?:https?:\/\/|[A-Za-z]:|\/)[^\r\n]+)/gi;
  text = text.replace(mediaLinePattern, (_match, value) => {
    add(value);
    return "\n";
  });

  const markdownImagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  text = text.replace(markdownImagePattern, (_match, label, value) => {
    if (!hasNativeImage) add(value, "image/*", label);
    return "\n";
  });

  // Local image/tool results commonly arrive as JSON text with a
  // `view_url` field instead of a native image content block. Promote those
  // URLs to real media so the desktop client displays the generated image.
  const toolImageUrlPattern = /["']?(?:view_url|image_url|media_url|mediaUrl)["']?\s*:\s*["'](https?:\/\/[^"'\\\s]+|[A-Za-z]:\\[^"'\\\s]+)["']/gi;
  text = text.replace(toolImageUrlPattern, (_match, value) => {
    add(String(value).replaceAll("\\/", "/"), "image/png", t("generateImage"));
    return "";
  });

  if (Array.isArray(message?.content)) {
    for (const block of message.content) {
      if (block?.type === "image") add(block.url ?? block.source?.url, "image/*", block.alt ?? "");
      if (block?.type === "attachment") {
        const attachment = block.attachment ?? {};
        add(attachment.url ?? attachment.path, attachment.mimeType ?? "", attachment.label ?? "");
      }
    }
  }
  if (typeof message?.mediaUrl === "string") add(message.mediaUrl);
  for (const value of Array.isArray(message?.mediaUrls) ? message.mediaUrls : []) add(value);

  return { text: text.trim(), media, files };
}

function hasVisibleContent(message) {
  if (isHiddenMessage(message)) return false;
  const parts = extractMessageParts(message);
  return Boolean(parts.text || parts.media.length || parts.files.length);
}

function visibleMessages() {
  const seen = new Set();
  let messages = [...state.history, ...localMessagesForSession()]
    .filter(hasVisibleContent)
    .filter((message) => {
      const parts = extractMessageParts(message);
      const signature = message?.imageRunId
        ? `image:${message.imageRunId}`
        : `${message?.role ?? ""}:${parts.text}:${parts.media.map((item) => item.raw).join(",")}:${message?.timestamp ?? ""}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  if (state.cancelledTurn?.sessionKey === currentSessionKey) {
    const cancelledText = cleanUserText(state.cancelledTurn.userText).trim();
    let cancelledIndex = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (
        messages[index]?.role === "user"
        && cleanUserText(contentText(messages[index]?.content)).trim() === cancelledText
      ) {
        cancelledIndex = index;
        break;
      }
    }
    if (cancelledIndex >= 0) {
      const nextUserIndex = messages.findIndex((message, index) => index > cancelledIndex && message?.role === "user");
      const boundary = nextUserIndex >= 0 ? nextUserIndex : messages.length;
      messages = messages.filter((message, index) => !(
        index > cancelledIndex
        && index < boundary
        && message?.role === "assistant"
      ));
    }
  }
  if (state.optimistic) {
    const optimisticText = cleanUserText(contentText(state.optimistic.content));
    const exists = messages.some(
      (message) =>
        message.role === "user" &&
        cleanUserText(contentText(message.content)).trim() === optimisticText.trim() &&
        Number(message.timestamp ?? 0) >= state.optimistic.timestamp - 5000
    );
    if (!exists) messages.push(state.optimistic);
  }
  return messages;
}

function createBrandSvg() {
  return `<svg class="vela-glyph" viewBox="0 0 32 32" aria-hidden="true"><path d="M7.5 8.5 16 24 24.5 8.5M11.5 8.5 16 17l4.5-8.5" /></svg>`;
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-mark">${createBrandSvg()}</div>
      <h1>${escapeHtml(t("title"))}</h1>
      <p>${escapeHtml(t("subtitle"))}</p>
      <div class="quick-grid">
        <button class="quick-action" type="button" data-quick="image">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M16.5 9h.01"></path>
          </svg>
          <strong>${escapeHtml(t("generateImage"))}</strong>
          <span>${escapeHtml(t("generateImageHint"))}</span>
        </button>
        <button class="quick-action" type="button" data-quick="file">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 3h7l4 4v14H7zM14 3v5h5"></path>
          </svg>
          <strong>${escapeHtml(t("analyzeFile"))}</strong>
          <span>${escapeHtml(t("analyzeFileHint"))}</span>
        </button>
        <button class="quick-action" type="button" data-quick="web">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"></path>
          </svg>
          <strong>${escapeHtml(t("openWeb"))}</strong>
          <span>${escapeHtml(t("openWebHint"))}</span>
        </button>
      </div>
    </div>`;
}

function renderMedia(parts) {
  const images = parts.media.filter((item) => item.kind === "image");
  const videos = parts.media.filter((item) => item.kind === "video");
  const audios = parts.media.filter((item) => item.kind === "audio");
  let html = "";
  if (images.length) {
    html += `<div class="media-grid">${images
      .map(
        (item) => `
          <button class="media-card" type="button" data-media-src="${escapeHtml(item.src)}">
            <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.label)}" loading="lazy" />
          </button>`
      )
      .join("")}</div>`;
  }
  for (const item of videos) {
    html += `<div class="media-grid"><video class="media-card" src="${escapeHtml(item.src)}" controls></video></div>`;
  }
  for (const item of audios) {
    html += `<div class="file-grid"><audio src="${escapeHtml(item.src)}" controls></audio></div>`;
  }
  if (parts.files.length) {
    html += `<div class="file-grid">${parts.files
      .map(
        (item) => `
          <a class="file-card" href="${escapeHtml(item.src)}" target="_blank" rel="noreferrer">
            <span class="file-card__icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v5h5"></path></svg>
            </span>
            <span class="file-card__copy">
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.mimeType || t("noText"))}</span>
            </span>
          </a>`
      )
      .join("")}</div>`;
  }
  return html;
}

function renderMessage(message) {
  const user = message.role === "user";
  const parts = extractMessageParts(message);
  const copy = parts.text ? `<div class="message-copy">${renderMarkdown(parts.text)}</div>` : "";
  const meta = formatTime(message.timestamp);
  return `
    <article class="message-row ${user ? "message-row--user" : "message-row--assistant"}">
      ${user ? "" : `<div class="message-avatar">${createBrandSvg()}</div>`}
      <div class="message-body">
        ${copy}
        ${renderMedia(parts)}
        ${meta ? `<div class="message-meta">${escapeHtml(meta)}</div>` : ""}
      </div>
    </article>`;
}

function renderThinking() {
  if (state.activeImageRun) {
    const value = Math.max(1, Math.min(99, Math.round(state.imageProgress.value || 1)));
    const stage = state.imageProgress.stage || t("progressPreparing");
    return `
      <article class="message-row message-row--assistant">
        <div class="message-avatar">${createBrandSvg()}</div>
        <div class="message-body image-progress-card">
          <div class="image-progress-visual" aria-hidden="true">
            <div class="image-progress-orb">
              <i></i><i></i><b></b>
            </div>
            <div class="image-progress-scan"></div>
          </div>
          <div class="image-progress-card__content">
            <div class="image-progress-card__header">
              <strong>${escapeHtml(stage)}</strong>
              <span>${value}%</span>
            </div>
            <div class="image-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}">
              <span style="width:${value}%"></span>
            </div>
            <div class="image-progress-card__detail">${escapeHtml(state.imageProgress.detail || t("progressEstimate"))}</div>
          </div>
        </div>
      </article>`;
  }
  return `
    <article class="message-row message-row--assistant">
      <div class="message-avatar">${createBrandSvg()}</div>
      <div class="message-body thinking-card">
        <div class="thinking-visual" aria-hidden="true">
          <i></i><i></i><b></b>
        </div>
        <div class="thinking-copy">
          <strong>${escapeHtml([
            t("thinkingUnderstand"),
            t("thinkingPlan"),
            t("thinkingExecute"),
            t("thinkingVerify")
          ][state.thinkingPhase % 4] || t("thinking"))}</strong>
          <div class="typing" aria-label="${escapeHtml(t("thinking"))}">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </article>`;
}

function messagesRenderKey(messages) {
  return JSON.stringify({
    language: state.language,
    pending: state.pending,
    thinkingPhase: state.thinkingPhase,
    imageProgress: state.activeImageRun ? state.imageProgress : null,
    sessionKey: currentSessionKey,
    messages: messages.map((message) => {
      const parts = extractMessageParts(message);
      return {
        role: message.role,
        timestamp: message.timestamp,
        text: parts.text,
        media: parts.media.map((item) => [item.kind, item.raw, item.label]),
        files: parts.files.map((item) => [item.raw, item.label, item.mimeType])
      };
    })
  });
}

function renderMessages(forceScroll = false) {
  const messages = visibleMessages();
  const previousMessageCount = els.chatContent.querySelectorAll(".message-row").length;
  const renderKey = messagesRenderKey(messages);
  if (renderKey === state.renderedMessagesKey) {
    if (forceScroll) {
      requestAnimationFrame(() => {
        els.chatScroll.scrollTop = messages.length === 0 ? 0 : els.chatScroll.scrollHeight;
      });
    }
    return;
  }

  const wasNearBottom =
    els.chatScroll.scrollHeight - els.chatScroll.scrollTop - els.chatScroll.clientHeight < 48;
  const previousScrollTop = els.chatScroll.scrollTop;
  state.renderedMessagesKey = renderKey;
  els.chatContent.innerHTML =
    messages.length === 0
      ? renderEmptyState()
      : messages.map(renderMessage).join("") + (state.pending ? renderThinking() : "");

  const renderedRows = Array.from(els.chatContent.querySelectorAll(".message-row"));
  renderedRows.slice(Math.max(0, previousMessageCount)).forEach((row, index) => {
    row.classList.add("message-row--fresh");
    row.style.animationDelay = `${Math.min(index * 45, 180)}ms`;
  });

  els.chatContent.querySelectorAll("a").forEach((link) => {
    link.target = "_blank";
    link.rel = "noreferrer";
  });
  els.chatContent.querySelectorAll("[data-media-src]").forEach((button) => {
    button.addEventListener("click", () => openMedia(button.dataset.mediaSrc));
  });
  els.chatContent.querySelectorAll("[data-quick]").forEach((button) => {
    button.addEventListener("click", () => handleQuickAction(button.dataset.quick));
  });
  if (messages.length === 0) {
    requestAnimationFrame(() => {
      els.chatScroll.scrollTop = 0;
    });
  } else if (forceScroll || wasNearBottom) {
    requestAnimationFrame(() => {
      els.chatScroll.scrollTop = els.chatScroll.scrollHeight;
    });
  } else {
    requestAnimationFrame(() => {
      els.chatScroll.scrollTop = previousScrollTop;
    });
  }
}

function renderSessions() {
  els.sessionList.innerHTML = state.sessions
    .map(
      (session) => `
        <div class="session-item-wrap ${session.key === currentSessionKey ? "is-active" : ""}">
        <button class="session-item" type="button" data-session="${escapeHtml(session.key)}">
          <span class="session-item__icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14v10H9l-4 3z"></path></svg>
          </span>
          <span class="session-item__copy">
            <span class="session-item__title">${escapeHtml(session.title || t("untitled"))}</span>
            <span class="session-item__time">${escapeHtml(formatTime(session.updatedAt))}</span>
          </span>
        </button>`
        + `<button class="session-item__delete" type="button" data-delete-session="${escapeHtml(session.key)}" aria-label="${escapeHtml(state.language === "zh" ? "删除会话" : "Delete chat")}" title="${escapeHtml(state.language === "zh" ? "删除会话" : "Delete chat")}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2m-7 0 1 13h6l1-13M10 11v5m4-5v5" /></svg>
        </button>
        </div>`
    )
    .join("");
  els.sessionList.querySelectorAll("[data-session]").forEach((button) => {
    button.addEventListener("click", () => void setSession(button.dataset.session));
  });
  els.sessionList.querySelectorAll("[data-delete-session]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      void deleteSession(button.dataset.deleteSession);
    });
  });
}

function renderHeader() {
  els.chatTitle.textContent = currentSession()?.title || "VELA";
}

function renderCommandDeck() {
  if (!els.commandDeck) return;
  const working = state.pending;
  const image = state.activeImageRun;
  const active = working ? (image ? "execute" : "plan") : "intent";
  const completed = working ? (image ? ["intent", "plan"] : ["intent"]) : [];
  els.commandDeck.classList.toggle("is-working", working);
  els.commandDeck.querySelectorAll("[data-deck-node]").forEach((node) => {
    const name = node.dataset.deckNode;
    node.classList.toggle("is-active", name === active);
    node.classList.toggle("is-complete", completed.includes(name));
  });
  const mode = image ? t("metricImage") : working ? t("metricWorking") : t("metricReady");
  els.deckMode.textContent = mode;
  els.deckSession.textContent = String(state.sessions.length);
  els.deckHistory.textContent = String(state.history.length);
  els.deckStatus.textContent = state.connected ? t("connected") : t("disconnected");
  els.workspaceToggle.textContent = els.commandDeck.classList.contains("is-collapsed") ? t("workspaceOpen") : t("workspaceClose");
}

function renderConnection() {
  els.connectionPill.classList.toggle("is-connected", state.connected);
  els.connectionPill.classList.toggle("is-error", !state.connected && Boolean(state.bootstrap));
  els.connectionLabel.textContent = state.connected ? t("connected") : state.bootstrap ? t("disconnected") : t("connecting");
  els.retryButton.hidden = state.connected;
}

function renderHealthBadge() {
  if (!els.healthBadge) return;
  const health = state.health;
  const pressure = Boolean(health.resources?.memoryPressure);
  const ready = Boolean(health.ok) && !pressure;
  els.healthBadge.classList.toggle("is-ready", ready);
  els.healthBadge.classList.toggle("is-warning", !ready);
  els.healthBadge.textContent = health.loading
    ? t("healthChecking")
    : pressure
      ? t("healthMemory")
      : ready
        ? t("healthReady")
        : t("healthDegraded");
  const services = Object.entries(health.services ?? {})
    .map(([name, item]) => `${name}: ${item?.state ?? "offline"}`)
    .join(" · ");
  const memory = health.resources
    ? `${health.resources.memoryFreeGb}/${health.resources.memoryTotalGb} GB free`
    : "";
  els.healthBadge.title = [services, memory].filter(Boolean).join("\n");
}

async function refreshHealth() {
  try {
    const response = await fetch("/api/health", {
      headers: { "X-Vela-App-Key": appKey },
      cache: "no-store"
    });
    if (!response.ok) throw new Error("Health check unavailable");
    state.health = { loading: false, ...await response.json() };
  } catch {
    state.health = { loading: false, ok: false, services: {}, resources: null };
  }
  renderHealthBadge();
}

function startHealthPolling() {
  if (state.healthTimer) window.clearInterval(state.healthTimer);
  void refreshHealth();
  state.healthTimer = window.setInterval(() => void refreshHealth(), 30000);
}

function renderAttachments() {
  els.attachmentStrip.hidden = state.attachments.length === 0;
  els.attachmentStrip.innerHTML = state.attachments
    .map(
      (attachment) => `
        <div class="attachment-chip">
          <span class="attachment-chip__preview">
            ${
              attachment.mimeType.startsWith("image/")
                ? `<img src="${escapeHtml(attachment.dataUrl)}" alt="" />`
                : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v5h5"></path></svg>`
            }
          </span>
          <span class="attachment-chip__copy">
            <strong>${escapeHtml(attachment.fileName)}</strong>
            <span>${escapeHtml(formatBytes(attachment.sizeBytes))}</span>
          </span>
          <button class="attachment-chip__remove" type="button" data-remove-attachment="${escapeHtml(attachment.id)}">×</button>
        </div>`
    )
    .join("");
  els.attachmentStrip.querySelectorAll("[data-remove-attachment]").forEach((button) => {
    button.addEventListener("click", () => {
      state.attachments = state.attachments.filter((item) => item.id !== button.dataset.removeAttachment);
      renderAttachments();
      updateSendButton();
    });
  });
}

function renderImageStudio() {
  els.imageStudio.hidden = !state.imageMode;
  els.composerInput.placeholder = state.imageMode
    ? state.language === "zh"
      ? "描述你想生成的 4K 画面"
      : "Describe the 4K image you want"
    : t("messagePlaceholder");
  els.imageStudio.querySelectorAll("[data-image-aspect]").forEach((button) => {
    const active = button.dataset.imageAspect === state.imageSettings.aspect;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  els.imageStudio.querySelectorAll("[data-image-engine]").forEach((button) => {
    const active = button.dataset.imageEngine === state.imageSettings.engine;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  els.imageStudio.querySelectorAll("[data-image-style]").forEach((button) => {
    const active = button.dataset.imageStyle === state.imageSettings.style;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  els.imageStudio.querySelectorAll("[data-image-quality]").forEach((button) => {
    const active = button.dataset.imageQuality === state.imageSettings.quality;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  els.imageStudio.querySelectorAll("[data-image-reference]").forEach((button) => {
    const active = button.dataset.imageReference === state.imageSettings.reference;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  els.imageStudio.querySelectorAll("[data-image-text]").forEach((button) => {
    const active = button.dataset.imageText === state.imageSettings.textMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderWorkspaceNav() {
  els.workspaceNav?.querySelectorAll("[data-workspace-view]").forEach((button) => {
    const active = button.dataset.workspaceView === state.workspaceView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  if (els.app) els.app.dataset.workspaceView = state.workspaceView;
}

function workspaceLabelKey(view) {
  return {
    tasks: "workspaceTasks",
    plans: "workspacePlans",
    runs: "workspaceRuns",
    models: "workspaceModels",
    tools: "workspaceTools"
  }[view] ?? "workspaceTasks";
}

function statusLabel(status) {
  return {
    ready: t("statusReady"),
    running: t("statusRunning"),
    completed: t("statusCompleted"),
    failed: t("statusFailed"),
    pending: t("statusPending"),
    paused: state.language === "zh" ? "已暂停" : "Paused",
    cancelled: state.language === "zh" ? "已取消" : "Cancelled",
    draft: state.language === "zh" ? "草稿" : "Draft"
  }[String(status ?? "").toLowerCase()] ?? String(status ?? "-");
}

function apiData(payload) {
  return payload?.data ?? payload ?? {};
}

function formatWorkspaceTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : formatTime(date.getTime());
}

function renderWorkspacePanel() {
  if (!els.workspacePanel) return;
  const visible = state.workspaceView !== "chat";
  els.workspacePanel.hidden = !visible;
  if (!visible) return;

  const data = state.workspaceData;
  els.workspacePanelTitle.textContent = t(workspaceLabelKey(state.workspaceView));
  els.workspacePanelSync.textContent = data.loading
    ? t("workspaceSyncing")
    : data.error
      ? t("workspaceOffline")
      : t("workspaceSynced");
  els.workspacePanelSync.classList.toggle("is-error", Boolean(data.error));

  const planCount = data.plans.length;
  const visiblePlans = state.workspaceView === "tasks"
    ? data.plans.filter((plan) => !["completed", "failed", "cancelled"].includes(String(plan.status)))
    : state.workspaceView === "runs"
      ? data.plans.filter((plan) => ["running", "completed", "failed", "cancelled"].includes(String(plan.status)))
      : data.plans;
  const components = Array.isArray(data.status?.components) ? data.status.components : [];
  const onlineCount = components.filter((item) => ["online", "ready", "healthy"].includes(String(item.state))).length;
  const metrics = [
    [t("workspaceStatus"), data.status?.state ?? (data.error ? t("statusOffline") : t("statusOnline"))],
    [t("workspaceSteps"), state.workspaceView === "models" ? String(state.models.items.length) : String(visiblePlans.length)],
    [t("workspaceUpdated"), formatWorkspaceTime(data.plans[0]?.updated_at ?? data.plans[0]?.updatedAt)]
  ];
  els.workspacePanelMetrics.innerHTML = metrics
    .map(([label, value]) => `<div class="workspace-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");

  if (state.workspaceView === "models") {
    els.workspacePanelList.innerHTML = state.models.items.length
      ? state.models.items.map((item) => `
          <button class="workspace-card workspace-card--model" type="button">
            <span class="workspace-card__signal"></span>
            <span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.id)}</small></span>
            <em>${escapeHtml(t("statusOnline"))}</em>
          </button>`).join("")
      : `<div class="workspace-empty">${escapeHtml(t("workspaceEmpty"))}</div>`;
    els.workspacePanelDetail.innerHTML = `
      <div class="workspace-detail__hero"><span class="workspace-detail__eyebrow">${escapeHtml(t("workspaceModels"))}</span><h3>${escapeHtml(state.models.primary || "-")}</h3><p>${escapeHtml(state.language === "zh" ? "支持直连 GGUF、Ollama 与 API。直连模式完全绕过 Ollama，并且只驻留一个模型。" : "Use direct GGUF, Ollama, or API models. Direct mode bypasses Ollama and keeps only one model resident.")}</p><button class="workspace-primary-action" type="button" data-open-model-center>打开模型中心</button></div>
      <div class="workspace-component-list">${components.map((item) => `<div><span>${escapeHtml(item.name ?? "component")}</span><strong class="status-pill status-pill--${escapeHtml(String(item.state ?? "offline"))}">${escapeHtml(String(item.state ?? "offline"))}</strong></div>`).join("") || `<div class="workspace-empty">${escapeHtml(t("workspaceNoDetail"))}</div>`}</div>`;
    return;
  }

  if (state.workspaceView === "tools") {
    els.workspacePanelList.innerHTML = components.length
      ? components.map((item) => `
          <div class="workspace-card workspace-card--tool">
            <span class="workspace-card__icon">⌘</span>
            <span><strong>${escapeHtml(item.name ?? "Local component")}</strong><small>${escapeHtml(item.detail ?? "")}</small></span>
            <em>${escapeHtml(String(item.state ?? "offline"))}</em>
          </div>`).join("")
      : `<div class="workspace-empty">${escapeHtml(t("workspaceNoDetail"))}</div>`;
    els.workspacePanelDetail.innerHTML = `<div class="workspace-detail__hero"><span class="workspace-detail__eyebrow">${escapeHtml(t("workspaceTools"))}</span><h3>${onlineCount} / ${components.length || 0}</h3><p>${escapeHtml(state.language === "zh" ? "工具和本地服务状态来自真实诊断接口。" : "Tool and local service status comes from the real diagnostics API.")}</p></div>`;
    return;
  }

  els.workspacePanelList.innerHTML = visiblePlans.length
    ? visiblePlans.map((plan) => {
        const active = plan.id === data.selectedPlanId;
        const steps = Array.isArray(plan.steps) ? plan.steps : [];
        return `<button class="workspace-card workspace-card--plan${active ? " is-active" : ""}" type="button" data-plan-id="${escapeHtml(plan.id)}">
          <span class="workspace-card__signal workspace-card__signal--${escapeHtml(String(plan.status ?? "pending"))}"></span>
          <span><strong>${escapeHtml(plan.goal ?? plan.id)}</strong><small>${steps.length} ${escapeHtml(t("workspaceSteps"))} · ${escapeHtml(formatWorkspaceTime(plan.updated_at ?? plan.updatedAt))}</small></span>
          <em class="status-pill status-pill--${escapeHtml(String(plan.status ?? "pending"))}">${escapeHtml(statusLabel(plan.status))}</em>
        </button>`;
      }).join("")
    : `<div class="workspace-empty workspace-empty--action"><span>${escapeHtml(data.error || (state.workspaceView === "runs" ? "还没有运行记录" : state.workspaceView === "tasks" ? "当前没有待处理任务" : t("workspaceEmpty")))}</span><button type="button" data-go-chat>${escapeHtml(state.language === "zh" ? "去对话中创建" : "Create in chat")}</button></div>`;

  const detail = data.detail;
  if (!detail?.plan) {
    els.workspacePanelDetail.innerHTML = `<div class="workspace-detail__empty"><span>◇</span><p>${escapeHtml(t("workspaceSelectPlan"))}</p></div>`;
    return;
  }
  const plan = detail.plan;
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const reflections = Array.isArray(detail.reflections) ? detail.reflections : [];
  els.workspacePanelDetail.innerHTML = `
    <div class="workspace-detail__hero">
      <span class="workspace-detail__eyebrow">${escapeHtml(state.workspaceView === "runs" ? "RUN TRACE" : state.workspaceView === "tasks" ? "ACTIVE TASK" : plan.id)}</span>
      <h3>${escapeHtml(plan.goal)}</h3>
      <div class="workspace-detail__meta"><span class="status-pill status-pill--${escapeHtml(String(plan.status))}">${escapeHtml(statusLabel(plan.status))}</span><span>${steps.length} ${escapeHtml(t("workspaceSteps"))}</span><span>${escapeHtml(formatWorkspaceTime(plan.updated_at ?? plan.updatedAt))}</span></div>
    </div>
    <div class="workspace-steps">${steps.map((step, index) => `
      <div class="workspace-step">
        <span class="workspace-step__index">${index + 1}</span>
        <div><strong>${escapeHtml(step.title ?? step.id)}</strong><p>${escapeHtml(step.description ?? "")}</p>${step.result ? `<pre class="workspace-step__result">${escapeHtml(String(step.result).slice(0, 700))}</pre>` : ""}${step.error ? `<pre class="workspace-step__error">${escapeHtml(String(step.error).slice(0, 700))}</pre>` : ""}</div>
        <em class="status-pill status-pill--${escapeHtml(String(step.status ?? "pending"))}">${escapeHtml(statusLabel(step.status))}</em>
      </div>`).join("")}</div>
    ${reflections.length ? `<section class="workspace-reflections"><h4>${escapeHtml(t("reflectionTitle"))}</h4>${reflections.map((item) => `<div class="workspace-reflection"><strong>${escapeHtml(item.failure_type ?? "unknown")}</strong><p>${escapeHtml(item.root_cause ?? item.summary ?? "")}</p><span>${escapeHtml(t("reflectionRetryable"))}: ${item.retryable ? "Yes" : "No"} · ${escapeHtml(t("reflectionSuggested"))}: ${escapeHtml(item.suggested_action ?? "-")}</span></div>`).join("")}</section>` : ""}`;
}

async function refreshWorkspace() {
  if (state.workspaceView === "chat" || state.workspaceData.loading) return;
  state.workspaceData.loading = true;
  renderWorkspacePanel();
  try {
    const headers = { "X-Vela-App-Key": appKey };
    const [statusResponse, plansResponse] = await Promise.all([
      fetch("/api/ocu/status", { headers, cache: "no-store" }),
      fetch("/api/ocu/plans", { headers, cache: "no-store" })
    ]);
    if (!statusResponse.ok || !plansResponse.ok) throw new Error("Local Agent API is unavailable.");
    const statusPayload = await statusResponse.json();
    const plansPayload = await plansResponse.json();
    state.workspaceData.status = apiData(statusPayload);
    state.workspaceData.plans = Array.isArray(apiData(plansPayload).plans) ? apiData(plansPayload).plans : [];
    state.workspaceData.error = "";
    const selected = state.workspaceData.plans.find((plan) => plan.id === state.workspaceData.selectedPlanId) ?? state.workspaceData.plans[0];
    if (selected) await selectWorkspacePlan(selected.id, false);
  } catch (error) {
    state.workspaceData.error = error instanceof Error ? error.message : String(error);
  } finally {
    state.workspaceData.loading = false;
    renderWorkspacePanel();
  }
}

async function selectWorkspacePlan(planId, redraw = true) {
  state.workspaceData.selectedPlanId = planId;
  if (redraw) renderWorkspacePanel();
  try {
    const response = await fetch(`/api/ocu/plans/${encodeURIComponent(planId)}`, {
      headers: { "X-Vela-App-Key": appKey },
      cache: "no-store"
    });
    if (!response.ok) throw new Error("Could not load plan detail.");
    state.workspaceData.detail = apiData(await response.json());
  } catch (error) {
    state.workspaceData.detail = null;
    state.workspaceData.error = error instanceof Error ? error.message : String(error);
  }
  renderWorkspacePanel();
}

function syncWorkspaceTimer() {
  if (state.workspaceView === "chat") {
    if (state.workspaceRefreshTimer) window.clearInterval(state.workspaceRefreshTimer);
    state.workspaceRefreshTimer = null;
    return;
  }
  if (!state.workspaceRefreshTimer) {
    state.workspaceRefreshTimer = window.setInterval(() => void refreshWorkspace(), 10000);
  }
}

function applyLanguage() {
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  els.languageLabel.textContent = state.language === "zh" ? "EN" : "中";
  renderAll();
}

function renderAll(forceScroll = false) {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.style.colorScheme = state.theme;
  els.themeButton?.setAttribute("aria-label", state.theme === "dark" ? t("themeLight") : t("themeDark"));
  if (els.themeButton) els.themeButton.title = state.theme === "dark" ? t("themeLight") : t("themeDark");
  els.composer.classList.toggle("is-image-mode", state.imageMode);
  els.imageModeButton.classList.toggle("is-active", state.imageMode);
  renderImageStudio();
  renderRunState();
  renderSessions();
  renderHeader();
  renderConnection();
  renderHealthBadge();
  renderAttachments();
  renderMessages(forceScroll);
  renderModelPicker();
  renderCommandDeck();
  renderWorkspaceNav();
  renderWorkspacePanel();
  syncWorkspaceTimer();
}

function renderModelPicker() {
  if (!els.modelSelect) return;
  const items = Array.isArray(state.models.items) ? state.models.items : [];
  els.modelSelect.innerHTML = items.length
    ? items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join("")
    : `<option value="">${escapeHtml(t("modelLoading"))}</option>`;
  els.modelSelect.value = state.models.primary || items[0]?.id || "";
  els.modelSelect.disabled = !state.connected || !items.length || state.pending;
  els.modelSelect.title = state.models.primary || t("modelLoading");
}

async function loadModels() {
  if (!els.modelSelect) return;
  try {
    const response = await fetch("/api/models", {
      headers: { "X-Vela-App-Key": appKey },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Model list failed (${response.status})`);
    state.models = await response.json();
    renderModelPicker();
    renderModelCenter();
  } catch (error) {
    renderModelPicker();
    toast(String(error));
  }
}

function renderModelCenter() {
  if (!els.recommendedModels) return;
  const installed = new Set((state.models.items || []).map((item) => item.id));
  els.recommendedModels.innerHTML = (state.models.recommended || []).map((item) => {
    const isInstalled = installed.has(`ollama/${item.id}`);
    return `<article class="model-card"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.use)} · ${escapeHtml(item.size)} · ${escapeHtml(item.fit)}</span><button type="button" data-install-model="${escapeHtml(item.id)}" ${isInstalled ? "disabled" : ""}>${isInstalled ? "已安装" : "一键安装"}</button></article>`;
  }).join("");
  if (els.directRuntimeInstall) {
    els.directRuntimeInstall.textContent = state.models.directRuntime?.installed ? "直连引擎已安装" : "安装直连引擎";
    els.directRuntimeInstall.disabled = Boolean(state.models.directRuntime?.installed);
  }
  if (els.directModels) {
    const direct = (state.models.items || []).filter((item) => item.provider === "direct");
    els.directModels.innerHTML = direct.length
      ? direct.map((item) => `<article class="model-card model-card--direct"><strong>${escapeHtml(item.label)}</strong><span>GGUF · ${escapeHtml(formatBytes(item.sizeBytes))} · ${item.runtimeReady ? "可直接运行" : "需安装直连引擎"}</span><button type="button" data-select-direct="${escapeHtml(item.id)}" ${item.runtimeReady ? "" : "disabled"}>${state.models.primary === item.id ? "正在使用" : "直接运行"}</button></article>`).join("")
      : `<div class="workspace-empty workspace-empty--action direct-model-empty"><span>还没有 GGUF 模型。可把已有模型放入 E:\\AI-Models，或下载适合本机的 Qwen3 4B Q4（约 2.5 GB）。</span><button type="button" data-download-direct="qwen3-4b-q4">下载到 E 盘</button></div>`;
  }
  const imageModels = Array.isArray(state.models.imageModels) ? state.models.imageModels : [];
  if (els.imageModels) {
    els.imageModels.innerHTML = imageModels.map((item) => {
      const button = item.installed
        ? `<button type="button" data-use-image-model="${escapeHtml(item.id)}">${state.imageSettings.engine === item.id ? "正在使用" : "在生图中使用"}</button>`
        : item.installable
          ? `<button type="button" data-install-image-model="${escapeHtml(item.id)}">一键安装到模型盘</button>`
          : `<button type="button" disabled>资源包暂不可自动安装</button>`;
      const tags = (item.tags || []).map((tag) => `<em>${escapeHtml(tag)}</em>`).join("");
      return `<article class="model-card model-card--image ${item.installed ? "is-installed" : ""}"><div class="model-card__top"><span class="model-card__icon">${escapeHtml(item.label.slice(0, 1))}</span><span class="model-card__status">${item.installed ? "已嵌入" : "未安装"}</span></div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.description)}${item.sizeBytes ? ` · ${escapeHtml(formatBytes(item.sizeBytes))}` : ""}</span><div class="model-card__tags">${tags}</div>${button}</article>`;
    }).join("");
  }
  if (els.modelCenterSummary) {
    const readyImages = imageModels.filter((item) => item.installed).length;
    const localChat = (state.models.items || []).filter((item) => ["ollama", "direct"].includes(item.provider)).length;
    els.modelCenterSummary.innerHTML = `<div><strong>${localChat}</strong><span>本地对话模型</span></div><div><strong>${readyImages}/${imageModels.length}</strong><span>生图模型已就绪</span></div><div><strong>${state.models.directRuntime?.installed ? "就绪" : "未安装"}</strong><span>直连引擎</span></div>`;
  }
  if (els.modelStoragePath) els.modelStoragePath.textContent = state.models.storage?.dataRoot || "尚未配置";
  if (els.imageRuntimeInstall) {
    els.imageRuntimeInstall.textContent = state.models.imageRuntime?.installed ? "生图引擎已就绪" : "一键准备生图引擎";
    els.imageRuntimeInstall.disabled = Boolean(state.models.imageRuntime?.installed);
  }
}

async function installImageModel(model) {
  const response = await fetch("/api/image-models/install", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Vela-App-Key": appKey },
    body: JSON.stringify({ model })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "生图模型安装失败");
  toast("正在下载到 D 盘模型缓存；完成后会自动嵌入 VELA");
  window.setTimeout(() => void refreshModelDownloads(), 1000);
}

async function installDirectRuntime() {
  const response = await fetch("/api/direct-runtime/install", {
    method: "POST",
    headers: { "X-Vela-App-Key": appKey }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "直连引擎安装失败");
  toast("正在把 llama.cpp 直连引擎安装到 E 盘");
  window.setTimeout(() => void refreshModelDownloads(), 1000);
}

async function installDirectModel(model) {
  const response = await fetch("/api/direct-models/install", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Vela-App-Key": appKey },
    body: JSON.stringify({ model })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "GGUF 模型下载失败");
  toast("正在把 GGUF 模型下载到 E 盘；下载期间仍可使用 API 模型");
  window.setTimeout(() => void refreshModelDownloads(), 1000);
}

async function installModel(model) {
  const response = await fetch("/api/models/install", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Vela-App-Key": appKey },
    body: JSON.stringify({ model })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "模型安装失败");
  toast(`正在下载 ${model}，完成后即可直接使用`);
  window.setTimeout(() => void refreshModelDownloads(), 800);
}

async function refreshModelDownloads() {
  if (!els.recommendedModels) return;
  const response = await fetch("/api/models/downloads", {
    headers: { "X-Vela-App-Key": appKey },
    cache: "no-store"
  });
  if (!response.ok) return;
  const payload = await response.json();
  const downloads = Array.isArray(payload.downloads) ? payload.downloads : [];
  const failed = downloads.find((item) => item.state === "failed");
  if (failed) {
    toast(`${failed.model} 安装失败：${failed.error || "未知错误"}`);
    await loadModels();
    return;
  }
  const active = downloads.find((item) => item.state === "downloading" || item.status === "downloading");
  if (active) {
    const progress = active.total > 0 ? (active.completed / active.total) * 100 : active.progress || 0;
    toast(`${active.model} · ${Math.max(0, Math.round(progress))}%`);
    window.setTimeout(() => void refreshModelDownloads(), 2500);
    return;
  }
  await loadModels();
}

function applyProviderTemplate() {
  const template = (state.models.providerTemplates || []).find((item) => item.id === els.providerTemplate?.value);
  if (!template) return;
  els.providerLabel.value = template.label;
  els.providerBaseUrl.value = template.baseUrl;
  els.providerModel.value = template.model;
}

async function saveProvider(event) {
  event.preventDefault();
  const id = els.providerTemplate.value === "custom"
    ? els.providerLabel.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-")
    : els.providerTemplate.value;
  const response = await fetch("/api/providers", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Vela-App-Key": appKey },
    body: JSON.stringify({
      id,
      label: els.providerLabel.value,
      baseUrl: els.providerBaseUrl.value,
      model: els.providerModel.value,
      apiKey: els.providerApiKey.value
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "API 模型保存失败");
  els.providerApiKey.value = "";
  await loadModels();
  toast("API 模型已安全保存，可以立即切换使用");
}

async function switchModel(modelId) {
  if (!modelId || modelId === state.models.primary || state.pending) return;
  const previous = state.models.primary;
  els.modelSelect.disabled = true;
  toast(t("modelSwitching"));
  try {
    const response = await fetch("/api/model", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Vela-App-Key": appKey
      },
      body: JSON.stringify({ model: modelId })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || t("modelSwitchFailed"));
    state.models.primary = payload.primary || modelId;
    renderModelPicker();
    toast(`${t("modelSwitched")}: ${payload.label || state.models.primary}`);
  } catch (error) {
    state.models.primary = previous;
    renderModelPicker();
    toast(`${t("modelSwitchFailed")}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function renderRunState() {
  els.sendButton.hidden = state.pending;
  els.stopButton.hidden = !state.pending;
  updateSendButton();
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function toast(message) {
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  els.toastRegion.append(element);
  setTimeout(() => {
    element.classList.add("is-leaving");
    setTimeout(() => element.remove(), 380);
  }, 2900);
}

function autoResizeComposer() {
  els.composerInput.style.height = "auto";
  els.composerInput.style.height = `${Math.min(els.composerInput.scrollHeight, 180)}px`;
}

function updateSendButton() {
  els.sendButton.disabled =
    !state.connected ||
    state.pending ||
    (!els.composerInput.value.trim() && state.attachments.length === 0);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

async function addFiles(fileList) {
  const files = [...fileList];
  if (state.attachments.length + files.length > 8 || files.some((file) => file.size > 25 * 1024 * 1024)) {
    toast(t("fileLimit"));
    return;
  }
  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    state.attachments.push({
      id: crypto.randomUUID(),
      dataUrl,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size
    });
  }
  renderAttachments();
  updateSendButton();
  toast(t("fileAdded"));
}

function attachmentPayloads() {
  return state.attachments.map((attachment) => ({
    type: attachment.mimeType.startsWith("image/") ? "image" : "file",
    mimeType: attachment.mimeType,
    fileName: attachment.fileName,
    content: attachment.dataUrl.split(",", 2)[1] ?? ""
  }));
}

function messageTitle(text) {
  const normalized = cleanUserText(text).replace(/\s+/g, " ").trim();
  if (!normalized) return t("noText");
  return normalized.length > 28 ? `${normalized.slice(0, 28)}…` : normalized;
}

async function sendMessage() {
  if (!state.client || !state.connected || state.pending) return;
  const rawText = els.composerInput.value.trim();
  if (!rawText && state.attachments.length === 0) return;

  // A transcript that already exhausted compaction cannot recover by sending
  // the same request again. Transparently roll over before accepting the next
  // user turn, while keeping the old chat available in the sidebar.
  if (state.history.some((message) =>
    message?.role === "assistant"
    && /Auto-compaction could not recover/i.test(contentText(message.content))
  )) {
    await newSession();
  }

  const isImageRequest = messageExecutionRoute(rawText, { imageMode: state.imageMode }) === "local-image";
  const attachments = attachmentPayloads();
  // All image requests use the dedicated local pipeline. It already performs
  // reference discovery, vision inspection, identity locking, model routing,
  // Native local inference and output upscaling. Sending these requests through the
  // chat agent caused it to call the image-edit tool and fail with
  // "image required" when no source image was attached.
  const useDirectImagePipeline = isImageRequest;
  const runId = crypto.randomUUID();
  state.cancelledTurn = null;
  state.activeUserText = rawText || t("noText");
  const requestController = new AbortController();
  const activeRun = runCoordinator.start({
    kind: useDirectImagePipeline ? "image" : "chat",
    requestId: runId,
    controller: requestController
  });
  const sentAt = Date.now();

  state.optimistic = {
    role: "user",
    content: rawText || t("noText"),
    timestamp: sentAt,
    _optimistic: true
  };
  state.pending = true;
  if (!isImageRequest) startThinkingFlow();
  state.activeRunId = runId;
  state.activeImageRun = isImageRequest;
  state.imageQueueSeen = false;
  state.imageStartedAt = isImageRequest ? Date.now() : 0;
  state.imageProgress = {
    value: isImageRequest ? 2 : 0,
    stage: isImageRequest ? t("progressPreparing") : "",
    detail: isImageRequest ? t("progressEstimate") : ""
  };
  if (isImageRequest) startImageStatusPolling();
  if (useDirectImagePipeline) {
    saveLocalImageMessage({
      role: "user",
      content: rawText || t("noText"),
      timestamp: sentAt,
      imageRunId: `${runId}:request`
    });
    state.optimistic = null;
  }
  const title = currentSession()?.title;
  if (!title || title === translations.zh.untitled || title === translations.en.untitled) {
    updateCurrentSession({ title: messageTitle(rawText), updatedAt: sentAt });
  } else {
    updateCurrentSession({ updatedAt: sentAt });
  }

  els.composerInput.value = "";
  autoResizeComposer();
  state.attachments = [];
  state.imageMode = false;
  renderAll(true);

  try {
    if (useDirectImagePipeline) {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Vela-App-Key": appKey
        },
        body: JSON.stringify({
          prompt: rawText,
          settings: state.imageSettings,
          attachments: attachments.filter((item) => item.type === "image").slice(0, 1)
        }),
        signal: requestController.signal
      });
      const payload = await response.json();
      if (!runCoordinator.isCurrent(activeRun)) return;
      if (!response.ok) throw new Error(payload.error || t("sendFailed"));
      const outputs = Array.isArray(payload.outputs) ? payload.outputs : [];
      if (!outputs.length) throw new Error("VELA image engine returned no image output.");
      const workflowEngine = payload.workflow?.engine === "flux2"
        ? (state.language === "zh" ? "参考编辑" : "reference edit")
        : payload.workflow?.engine === "realistic"
          ? (state.language === "zh" ? "写实模型" : "realistic model")
          : payload.workflow?.engine === "anime"
            ? (state.language === "zh" ? "动漫模型" : "anime model")
            : (state.language === "zh" ? "通用模型" : "general model");
      const workflowNote = payload.workflow
        ? `${state.language === "zh" ? "工作流" : "Workflow"} · ${workflowEngine}${payload.referenceSource ? ` · ${state.language === "zh" ? "参考" : "reference"}: ${payload.referenceSource}` : ""}`
        : "";
      const imageMessage = {
        role: "assistant",
        content: [
          outputs.map((output) => `MEDIA: ${output.path || output.viewUrl}`).join("\n"),
          payload.width && payload.height
            ? `\n${state.language === "zh" ? "已生成" : "Generated"} ${payload.width}×${payload.height} · ${payload.resolution ?? "4K"}`
            : "",
          workflowNote ? `\n${workflowNote}` : ""
        ].join(""),
        timestamp: Date.now(),
        imageRunId: payload.promptId || runId,
        imageMetadata: {
          width: payload.width,
          height: payload.height,
          resolution: payload.resolution ?? "4K",
          engine: payload.engine,
          referenceUsed: payload.referenceUsed,
          referenceSource: payload.referenceSource,
          referenceScore: payload.referenceScore,
          workflow: payload.workflow
        }
      };
      saveLocalImageMessage(imageMessage);
      state.history = [...state.history];
      state.pending = false;
      state.activeRunId = null;
      state.activeUserText = "";
      state.optimistic = null;
      stopImageStatusPolling();
      stopThinkingFlow();
      runCoordinator.finish(activeRun);
      renderAll(true);
      return;
    }
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Vela-App-Key": appKey
      },
      body: JSON.stringify({ message: rawText, session_id: currentSessionKey }),
      signal: requestController.signal
    });
    const payload = await response.json();
    if (!runCoordinator.isCurrent(activeRun)) return;
    if (!response.ok) throw new Error(payload.error || t("sendFailed"));
    state.history = [
      ...state.history.filter((item) => !item._optimistic),
      { role: "user", content: rawText, timestamp: sentAt },
      { role: "assistant", content: payload.output, timestamp: Date.now() }
    ];
    state.pending = false;
    state.activeRunId = null;
    state.activeUserText = "";
    state.optimistic = null;
    runCoordinator.finish(activeRun);
    stopThinkingFlow();
    renderAll(true);
  } catch (error) {
    if (!runCoordinator.isCurrent(activeRun) || /cancelled|canceled|aborted|fetch failed/i.test(String(error))) return;
    if (isImageRequest) {
      state.optimistic = null;
      saveLocalImageMessage({
        role: "assistant",
        content: state.language === "zh"
          ? `生图失败：${error instanceof Error ? error.message : String(error)}`
          : `Image generation failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        imageRunId: `${runId}:error`
      });
    }
    state.pending = false;
    state.activeRunId = null;
    state.activeUserText = "";
    runCoordinator.finish(activeRun);
    stopImageStatusPolling();
    stopThinkingFlow();
    toast(`${t("sendFailed")}: ${String(error)}`);
    renderAll();
  }
}

async function abortRun() {
  if (!state.client || !state.connected || !state.pending) return;
  const cancelledRun = runCoordinator.cancel();
  const cancelledUserText = state.activeUserText;
  const wasImageRun = state.activeImageRun;
  const sessionKey = currentSessionKey;
  state.pending = false;
  state.activeRunId = null;
  if (!wasImageRun && cancelledUserText) {
    state.cancelledTurn = { sessionKey, userText: cancelledUserText };
  }
  state.activeUserText = "";
  state.optimistic = null;
  stopImageStatusPolling();
  stopThinkingFlow();
  renderAll();
  if (wasImageRun) {
    try {
      await fetch("/api/image-cancel", {
        method: "POST",
        headers: { "X-Vela-App-Key": appKey }
      });
      toast(state.language === "zh" ? "正在停止生图任务" : "Stopping image generation");
    } catch {
      // The local job may already have completed.
    }
  }
  if (!wasImageRun && cancelledRun) {
    toast(state.language === "zh" ? "任务已取消" : "Task cancelled");
  }
  scheduleRefresh(250);
}

function scheduleRefresh(delay = 300) {
  clearTimeout(state.refreshTimer);
  state.refreshTimer = setTimeout(() => void refreshHistory(), delay);
}

async function refreshHistory(forceScroll = false) {
  if (!state.client || !state.connected) return;
  if (state.refreshInFlight) {
    state.refreshQueued = true;
    state.refreshForceScroll ||= forceScroll;
    return;
  }

  state.refreshInFlight = true;
  const requestedKey = currentSessionKey;
  try {
    const result = await fetch(`/api/sessions/${encodeURIComponent(requestedKey)}/messages`, {
      headers: { "X-Vela-App-Key": appKey },
      cache: "no-store"
    }).then((response) => {
      if (!response.ok) throw new Error(`Session history failed (${response.status})`);
      return response.json();
    });
    if (requestedKey !== currentSessionKey) return;
    const next = Array.isArray(result?.messages)
      ? result.messages.map(normalizeHistoryMessage)
      : [];
    const previousVisibleCount = state.history.filter(hasVisibleContent).length;
    const localImages = localMessagesForSession(requestedKey);
    const knownMedia = new Set(
      next.flatMap((message) => extractMessageParts(message).media.map((item) => item.raw))
    );
    const combinedHistory = [
      ...next,
      ...localImages.filter((message) =>
        extractMessageParts(message).media.some((item) => !knownMedia.has(item.raw))
      )
    ];
    const historySignature = JSON.stringify(combinedHistory);
    const historyChanged = historySignature !== state.historySignature;
    state.history = combinedHistory;
    state.historySignature = historySignature;
    const newestVisible = latestMessageByRole(next.filter(hasVisibleContent), "assistant");
    if (
      state.pending &&
      newestVisible?.role === "assistant" &&
      Number(newestVisible.timestamp ?? 0) >= Number(state.optimistic?.timestamp ?? 0)
    ) {
      state.pending = false;
      state.activeRunId = null;
      state.activeUserText = "";
      if (runCoordinator.active) runCoordinator.finish(runCoordinator.active);
      stopImageStatusPolling();
      stopThinkingFlow();
    }
    if (
      state.optimistic &&
      next.some(
        (message) =>
          message.role === "user" &&
          Number(message.timestamp ?? 0) >= state.optimistic.timestamp - 5000
      )
    ) {
      state.optimistic = null;
    }
    const nextVisibleCount = next.filter(hasVisibleContent).length;
    if (historyChanged || forceScroll) {
      renderMessages(forceScroll || nextVisibleCount > previousVisibleCount);
    }
    renderRunState();
  } catch (error) {
    if (!String(error).includes("not found")) {
      console.warn("History refresh failed", error);
    }
  } finally {
    state.refreshInFlight = false;
    if (state.refreshQueued) {
      const queuedForceScroll = state.refreshForceScroll;
      state.refreshQueued = false;
      state.refreshForceScroll = false;
      void refreshHistory(queuedForceScroll);
    }
  }
}

function stopImageStatusPolling() {
  clearInterval(state.imageStatusTimer);
  state.imageStatusTimer = null;
  state.activeImageRun = false;
  state.imageQueueSeen = false;
  state.imageStartedAt = 0;
  state.imageProgress = { value: 0, stage: "", detail: "" };
}

function startThinkingFlow() {
  stopThinkingFlow();
  state.thinkingPhase = 0;
  state.thinkingTimer = setInterval(() => {
    if (!state.pending || state.activeImageRun) return;
    state.thinkingPhase = (state.thinkingPhase + 1) % 4;
    renderMessages();
  }, 1250);
}

function stopThinkingFlow() {
  clearInterval(state.thinkingTimer);
  state.thinkingTimer = null;
  state.thinkingPhase = 0;
}

function imagePhasePresentation(status, elapsedSeconds) {
  const zh = state.language === "zh";
  const workflow = status?.workflow ?? {};
  const engine = workflow.engine === "flux2" ? "参考编辑" : workflow.engine === "realistic" ? "写实摄影" : workflow.engine === "anime" ? "动漫角色" : "通用概念";
  const phases = {
    "analyzing-request": [6, zh ? "理解画面需求" : "Understanding the image", zh ? "提取主体、场景、动作、镜头和限制" : "Extracting subject, scene, camera and constraints"],
    "compiling-spec": [12, zh ? "建立画面规格" : "Building the visual spec", zh ? `题材：${workflow.subjectType ?? "自动"} · ${engine}` : `Subject: ${workflow.subjectType ?? "auto"} · ${engine}`],
    "reference-search": [18, zh ? "搜索视觉参考" : "Searching visual references", zh ? "优先查找官方角色图或真实地点特征" : "Prioritizing official identity or real-location traits"],
    "reference-validation": [24, zh ? "验证参考图片" : "Validating references", zh ? "识别并排除错人、拼图和低质量缩略图" : "Rejecting mismatches, collages and poor thumbnails"],
    "reference-vision": [30, zh ? "识别稳定特征" : "Inspecting stable traits", zh ? "提取轮廓、配色、标记、材质和地标结构" : "Reading silhouette, palette, markings and landmark structure"],
    "prompt-compilation": [36, zh ? "编译镜头语言" : "Compiling camera language", zh ? "组合构图、机位、光线、尺度和禁止项" : "Combining composition, camera, light, scale and exclusions"],
    "loading-model": [42, zh ? "加载专用模型" : "Loading the specialist model", zh ? `已选择：${engine}` : `Selected: ${engine}`],
    generating: [Math.min(88, 48 + elapsedSeconds * 0.45), zh ? "本地生成中" : "Generating locally", zh ? "正在执行扩散采样与细节合成" : "Running diffusion sampling and detail synthesis"],
    "finalizing-output": [96, zh ? "整理最终图片" : "Finalizing output", zh ? "保存结果与画面规格" : "Saving the result and visual specification"]
  };
  const [value, stage, detail] = phases[status?.activePhase] ?? [Math.min(88, 24 + elapsedSeconds * 0.55), t("progressGenerating"), zh ? "执行本地生图工作流" : "Running the local image workflow"];
  return { value, stage, detail };
}

async function refreshImageStatus() {
  if (!state.pending || !state.activeImageRun) return;
  const elapsedSeconds = Math.max(0, (Date.now() - state.imageStartedAt) / 1000);
  try {
    const status = await fetch("/api/image-status", {
      headers: { "X-Vela-App-Key": appKey },
      cache: "no-store"
    }).then((response) => response.json());

    if (!status.online) {
      state.imageProgress = {
        value: 1,
        stage: t("progressOffline"),
        detail: state.language === "zh" ? "正在检查 VELA 图像引擎" : "Checking VELA image engine"
      };
    } else if (status.running > 0) {
      state.imageQueueSeen = true;
      state.imageProgress = imagePhasePresentation(status, elapsedSeconds);
    } else if (status.pending > 0) {
      state.imageQueueSeen = true;
      state.imageProgress = {
        value: Math.min(22, 14 + elapsedSeconds * 0.12),
        stage: t("progressQueued"),
        detail: state.language === "zh" ? `前方等待 ${status.pending - 1} 个任务` : `${Math.max(0, status.pending - 1)} task(s) ahead`
      };
    } else if (state.imageQueueSeen) {
      state.imageProgress = {
        value: 98,
        stage: t("progressChecking"),
        detail: state.language === "zh" ? "不再进行生成后审查" : "No post-generation review"
      };
    } else {
      const designStages = [
        [t("progressSemantic"), state.language === "zh" ? "识别人物、动物、建筑、物品、场景与动作" : "Identifying subjects, scene and action"],
        [t("progressDetail"), state.language === "zh" ? "补全材质、环境、景深与自然阴影" : "Adding materials, environment, depth and natural shadows"],
        [t("progressComposition"), state.language === "zh" ? "确定视觉重心、机位、焦距与前中后景" : "Setting focus, camera, lens and scene depth"],
        [t("progressStyle"), state.language === "zh" ? "把风格名称转换为可执行的视觉特征" : "Converting style names into visual traits"],
        [t("progressConsistency"), state.language === "zh" ? "消除时间、天气、材质和画风冲突" : "Resolving time, weather, material and style conflicts"],
        [t("progressRouting"), state.language === "zh" ? "匹配动漫、写实或文字专用模型" : "Matching anime, photo or text specialist model"]
      ];
      const designIndex = Math.min(designStages.length - 1, Math.floor(elapsedSeconds / 3));
      state.imageProgress = {
        value: Math.min(18, 2 + designIndex * 3 + (elapsedSeconds % 3)),
        stage: designStages[designIndex][0],
        detail: designStages[designIndex][1]
      };
    }
    renderMessages();
  } catch {
    state.imageProgress = {
      value: Math.min(10, 2 + elapsedSeconds * 0.1),
      stage: t("progressPreparing"),
      detail: state.language === "zh" ? "正在连接本地生图状态" : "Connecting to local image status"
    };
    renderMessages();
  }
}

function startImageStatusPolling() {
  clearInterval(state.imageStatusTimer);
  void refreshImageStatus();
  state.imageStatusTimer = setInterval(() => void refreshImageStatus(), 1000);
}

function startPolling() {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    if (state.connected) void refreshHistory();
  }, 6000);
}

async function connectVela() {
  try {
    state.bootstrap = await fetch("/api/bootstrap", {
      headers: { "X-Vela-App-Key": appKey }
    }).then((response) => {
      if (!response.ok) throw new Error(`Bootstrap failed (${response.status})`);
      return response.json();
    });
    const remoteSessions = await fetch("/api/sessions", {
      headers: { "X-Vela-App-Key": appKey },
      cache: "no-store"
    }).then((response) => response.json());
    state.sessions = Array.isArray(remoteSessions.sessions)
      ? remoteSessions.sessions.map((item) => ({
          key: item.id,
          title: item.title,
          updatedAt: Date.parse(item.updated_at) || Date.now()
        }))
      : [];
    state.client = { mode: "vela-independent" };
    state.connected = true;
    if (!state.sessions.length) await newSession();
    else if (!state.sessions.some((item) => item.key === currentSessionKey)) {
      currentSessionKey = state.sessions[0].key;
    }
    saveSessions();
    renderConnection();
    startHealthPolling();
    renderModelPicker();
    startPolling();
    await refreshHistory(true);
  } catch (error) {
    state.connected = false;
    state.bootstrap = state.bootstrap ?? {};
    renderConnection();
    toast(String(error));
  }
}

function handleQuickAction(kind) {
  if (kind === "file") {
    els.fileInput.click();
    return;
  }
  if (kind === "image") {
    state.imageMode = true;
    renderAll();
    els.composerInput.focus();
    return;
  }
  els.composerInput.value =
    state.language === "zh"
      ? "请联网搜索并整理："
      : "Search the web and synthesize:";
  autoResizeComposer();
  updateSendButton();
  els.composerInput.focus();
}

function openMedia(src) {
  els.mediaDialogImage.src = src;
  els.mediaDialog.showModal();
}

els.newChatButton.addEventListener("click", () => void newSession());
els.languageButton.addEventListener("click", () => {
  state.language = state.language === "zh" ? "en" : "zh";
  localStorage.setItem("vela.desktop.language", state.language);
  applyLanguage();
});
els.themeButton.addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("vela.desktop.theme", state.theme);
  document.documentElement.classList.add("theme-transitioning");
  window.setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 420);
  renderAll();
});
els.workspaceNav?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-workspace-view]");
  if (!button) return;
  state.workspaceView = button.dataset.workspaceView;
  renderAll();
  if (state.workspaceView === "chat") {
    els.composerInput.focus();
    return;
  }
  const label = button.querySelector("[data-i18n]")?.textContent ?? button.dataset.workspaceView;
  toast(`${label} · ${state.language === "zh" ? "正在同步本地 Agent" : "Syncing local agent"}`);
  void refreshWorkspace();
});
els.workspacePanelRefresh?.addEventListener("click", () => void refreshWorkspace());
els.workspacePanelList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-plan-id]");
  if (button) void selectWorkspacePlan(button.dataset.planId);
});
els.sidebarButton.addEventListener("click", () => els.sidebar.classList.toggle("is-open"));
els.retryButton.addEventListener("click", connectVela);
els.modelSelect?.addEventListener("change", () => void switchModel(els.modelSelect.value));
els.modelCenterButton?.addEventListener("click", () => {
  renderModelCenter();
  els.modelCenterDialog?.showModal();
});
els.modelCenterClose?.addEventListener("click", () => els.modelCenterDialog?.close());
els.onboardingStorage?.addEventListener("click", () => els.modelStorageSelect?.click());
els.onboardingModels?.addEventListener("click", () => {
  els.onboardingDialog?.close();
  renderModelCenter();
  els.modelCenterDialog?.showModal();
});
for (const button of [els.onboardingFinish, els.onboardingSkip]) {
  button?.addEventListener("click", () => {
    localStorage.setItem("vela.desktop.onboarding", "complete");
    els.onboardingDialog?.close();
    if (button === els.onboardingFinish) void refreshWorkspace();
  });
}
els.modelStorageSelect?.addEventListener("click", async () => {
  els.modelStorageSelect.disabled = true;
  try {
    const response = await fetch("/api/storage/select", { method: "POST", headers: { "X-Vela-App-Key": appKey } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "无法更改数据目录");
    if (!payload.canceled) {
      toast("数据目录已更新，重启 VELA 后全部组件将使用新目录");
      await loadModels();
    }
  } catch (error) {
    toast(String(error));
  } finally {
    els.modelStorageSelect.disabled = false;
  }
});
els.appUpdateButton?.addEventListener("click", async () => {
  els.appUpdateButton.disabled = true;
  try {
    const statusResponse = await fetch("/api/update", { headers: { "X-Vela-App-Key": appKey } });
    const status = await statusResponse.json();
    const endpoint = status.state === "available" ? "/api/update/download" : "/api/update/check";
    const response = await fetch(endpoint, { method: "POST", headers: { "X-Vela-App-Key": appKey } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "更新检查失败");
    toast(endpoint.endsWith("download") ? "正在后台下载更新" : "正在检查新版本");
  } catch (error) {
    toast(String(error));
  } finally {
    window.setTimeout(() => { els.appUpdateButton.disabled = false; }, 1500);
  }
});
els.modelCenterDialog?.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-model-tab]");
  if (tab) {
    els.modelCenterDialog.querySelectorAll("[data-model-tab]").forEach((item) => item.classList.toggle("is-active", item === tab));
    els.modelCenterDialog.querySelectorAll("[data-model-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.modelPanel === tab.dataset.modelTab));
  }
  const install = event.target.closest("[data-install-image-model]");
  if (install) {
    install.disabled = true;
    void installImageModel(install.dataset.installImageModel).catch((error) => {
      install.disabled = false;
      toast(String(error));
    });
  }
  const use = event.target.closest("[data-use-image-model]");
  if (use) {
    state.imageSettings.engine = use.dataset.useImageModel;
    state.imageMode = true;
    saveImageSettings();
    renderAll();
    els.modelCenterDialog.close();
    toast("已切换生图模型");
  }
});
els.recommendedModels?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-install-model]");
  if (!button) return;
  button.disabled = true;
  void installModel(button.dataset.installModel).catch((error) => {
    button.disabled = false;
    toast(String(error));
  });
});
els.directRuntimeInstall?.addEventListener("click", () => {
  els.directRuntimeInstall.disabled = true;
  void installDirectRuntime().catch((error) => {
    els.directRuntimeInstall.disabled = false;
    toast(String(error));
  });
});
els.imageRuntimeInstall?.addEventListener("click", async () => {
  els.imageRuntimeInstall.disabled = true;
  try {
    const response = await fetch("/api/image-runtime/install", { method: "POST", headers: { "X-Vela-App-Key": appKey } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "生图引擎准备失败");
    toast("正在模型盘准备生图运行环境，这可能需要一些时间");
    window.setTimeout(() => void refreshModelDownloads(), 1500);
  } catch (error) {
    els.imageRuntimeInstall.disabled = false;
    toast(String(error));
  }
});
els.directModels?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-direct]");
  if (button) void switchModel(button.dataset.selectDirect);
  const download = event.target.closest("[data-download-direct]");
  if (download) {
    download.disabled = true;
    void installDirectModel(download.dataset.downloadDirect).catch((error) => {
      download.disabled = false;
      toast(String(error));
    });
  }
});
els.workspacePanel?.addEventListener("click", (event) => {
  if (event.target.closest("[data-go-chat]")) {
    state.workspaceView = "chat";
    renderAll();
    els.composerInput.focus();
  }
  if (event.target.closest("[data-open-model-center]")) {
    renderModelCenter();
    els.modelCenterDialog?.showModal();
  }
});
els.providerTemplate?.addEventListener("change", applyProviderTemplate);
els.providerForm?.addEventListener("submit", (event) => {
  void saveProvider(event).catch((error) => toast(String(error)));
});
els.workspaceToggle?.addEventListener("click", () => {
  els.commandDeck.classList.toggle("is-collapsed");
  renderCommandDeck();
});
els.attachButton.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", async () => {
  await addFiles(els.fileInput.files);
  els.fileInput.value = "";
});
els.imageModeButton.addEventListener("click", () => {
  state.imageMode = !state.imageMode;
  if (state.imageMode) toast(t("imageModeActive"));
  renderAll();
  els.composerInput.focus();
});
els.imageStudio.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.imagePreset) {
    els.composerInput.value = button.dataset.imagePreset;
    autoResizeComposer();
    updateSendButton();
    els.composerInput.focus();
    return;
  }
  if (button.dataset.imageAspect) state.imageSettings.aspect = button.dataset.imageAspect;
  if (button.dataset.imageEngine) state.imageSettings.engine = button.dataset.imageEngine;
  if (button.dataset.imageStyle) state.imageSettings.style = button.dataset.imageStyle;
  if (button.dataset.imageQuality) state.imageSettings.quality = button.dataset.imageQuality;
  if (button.dataset.imageReference) state.imageSettings.reference = button.dataset.imageReference;
  if (button.dataset.imageText) state.imageSettings.textMode = button.dataset.imageText;
  saveImageSettings();
  renderImageStudio();
  els.composerInput.focus();
});
els.sendButton.addEventListener("click", sendMessage);
els.stopButton.addEventListener("click", abortRun);
let composerUpdateFrame = 0;
els.composerInput.addEventListener("input", () => {
  if (composerUpdateFrame) return;
  composerUpdateFrame = requestAnimationFrame(() => {
    composerUpdateFrame = 0;
    updateSendButton();
  });
});
els.composerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void sendMessage();
  }
});
els.mediaClose.addEventListener("click", () => els.mediaDialog.close());
els.mediaDialog.addEventListener("click", (event) => {
  if (event.target === els.mediaDialog) els.mediaDialog.close();
});

let dragDepth = 0;
window.addEventListener("dragenter", (event) => {
  event.preventDefault();
  dragDepth += 1;
  els.dropOverlay.classList.add("is-visible");
});
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("dragleave", (event) => {
  event.preventDefault();
  dragDepth -= 1;
  if (dragDepth <= 0) {
    dragDepth = 0;
    els.dropOverlay.classList.remove("is-visible");
  }
});
window.addEventListener("drop", async (event) => {
  event.preventDefault();
  dragDepth = 0;
  els.dropOverlay.classList.remove("is-visible");
  await addFiles(event.dataTransfer?.files ?? []);
});

applyLanguage();
renderAll(true);
autoResizeComposer();
void connectVela();
void loadModels();
if (!localStorage.getItem("vela.desktop.onboarding")) {
  window.setTimeout(() => els.onboardingDialog?.showModal(), 650);
}
