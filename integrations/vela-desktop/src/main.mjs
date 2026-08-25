import { app, BrowserWindow, dialog, safeStorage, shell } from "electron";
import updaterPackage from "electron-updater";
import { execFile, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  analyzeImageRequest,
  buildReferenceQueries,
  compileImagePrompt,
  compileNegativePrompt,
  configureMultiReferenceIpAdapter,
  parseVisualReviewResponse,
  publicWorkflowSummary,
  selectReferenceCandidate,
  imageJobIsStale,
  requiresSemanticIdentityReview
} from "./image-workflow.mjs";
import {
  loadModelCenterConfig,
  modelRuntimeEnvironment,
  publicModelCenterConfig,
  RECOMMENDED_LOCAL_MODELS,
  saveModelCenterConfig
} from "./model-center.mjs";
import {
  buildLlamaServerArgs,
  DIRECT_MODEL_PORT,
  directModelId,
  discoverGgufModels,
  findLlamaServer
} from "./direct-model-runtime.mjs";
import { imageModelCatalog, imageModelInstallAssets } from "./image-model-catalog.mjs";
import { ensureStorageDirectories, loadStorageConfig, saveStorageConfig } from "./storage-config.mjs";
import { isMissingSessionError } from "./session-recovery.mjs";
import { buildSystemProfile } from "./system-profile.mjs";
import {
  loadPermissionConfig,
  permissionRuntimeEnvironment,
  publicPermissionConfig,
  savePermissionConfig
} from "./permission-center.mjs";
import {
  installPlugin,
  loadPluginConfig,
  pluginRuntimeEnvironment,
  publicPluginCatalog,
  uninstallPlugin
} from "./plugin-center.mjs";
import { runWithDeadline } from "./async-deadline.mjs";

const { autoUpdater } = updaterPackage;

const APP_PORT = 18790;
const APP_HOST = "127.0.0.1";
const VELA_RELEASE = "2.5.0-beta.5";
const COMFY_PORT = 8188;
const NATIVE_IMAGE_PORT = 8190;
const OCU_PORT = 8765;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const VELA_PROJECT_ROOT = process.env.VELA_PROJECT_ROOT
  ?? process.env.OCU_PROJECT_ROOT
  ?? (app.isPackaged ? path.join(process.resourcesPath, "agent") : path.resolve(appRoot, "..", ".."));
const rendererRoot = path.join(appRoot, "renderer");
const appKey = !app.isPackaged && process.env.VELA_E2E_APP_KEY?.trim()
  ? process.env.VELA_E2E_APP_KEY.trim()
  : crypto.randomBytes(24).toString("hex");
const modelDownloads = new Map();
const modelDownloadControllers = new Map();
let updateState = { state: "idle", version: VELA_RELEASE, progress: 0, error: "" };

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on("checking-for-update", () => { updateState = { ...updateState, state: "checking", error: "" }; });
autoUpdater.on("update-available", (info) => { updateState = { ...updateState, state: "available", version: info.version, error: "" }; });
autoUpdater.on("update-not-available", () => { updateState = { ...updateState, state: "current", version: VELA_RELEASE, error: "" }; });
autoUpdater.on("download-progress", (progress) => { updateState = { ...updateState, state: "downloading", progress: Number(progress.percent || 0) }; });
autoUpdater.on("update-downloaded", (info) => { updateState = { ...updateState, state: "ready", version: info.version, progress: 100 }; });
autoUpdater.on("error", (error) => { updateState = { ...updateState, state: "failed", error: error.message }; });

function storageConfigPath() {
  return path.join(app.getPath("userData"), "storage.json");
}

function permissionConfigPath() {
  return path.join(app.getPath("userData"), "permissions.json");
}

function pluginConfigPath() {
  return path.join(app.getPath("userData"), "plugins.json");
}

function readStorageConfig() {
  const configPath = storageConfigPath();
  if (process.platform === "win32" && !fs.existsSync(configPath) && fs.existsSync("D:\\AI-Models-HotCache\\Models")) {
    return saveStorageConfig(configPath, { dataRoot: "D:\\AI-Models-HotCache" });
  }
  return loadStorageConfig(configPath, app.getPath("documents"));
}

function storagePaths() {
  const storage = readStorageConfig();
  ensureStorageDirectories(storage);
  const legacyImageRoot = "E:\\AI-Models\\Image-Generation";
  const directLegacy = "E:\\AI-Models\\Runtimes\\llama.cpp";
  const currentImageEngineRoot = path.join(storage.dataRoot, "ImageEngine");
  const installedImageEngineRoot = path.join(storage.dataRoot, "VELA-ImageEngine");
  const pythonRelativePath = process.platform === "win32" ? path.join("runtime", "python.exe") : path.join("runtime", "bin", "python");
  const imageEngineRoot = fs.existsSync(path.join(installedImageEngineRoot, pythonRelativePath))
    ? installedImageEngineRoot
    : currentImageEngineRoot;
  return {
    ...storage,
    imageEngineRoot,
    nativePython: path.join(imageEngineRoot, pythonRelativePath),
    nativePackages: path.join(imageEngineRoot, "python_packages"),
    comfyOutputRoot: fs.existsSync(legacyImageRoot) ? path.join(legacyImageRoot, "Outputs") : path.join(storage.outputRoot, "Images"),
    characterMemoryRoot: fs.existsSync(legacyImageRoot) ? path.join(legacyImageRoot, "Character-Memory") : path.join(storage.dataRoot, "Character-Memory"),
    directRuntimeRoot: fs.existsSync(directLegacy) ? directLegacy : path.join(storage.runtimeRoot, "llama.cpp")
  };
}

function comfyInputRoot() {
  const legacy = "C:\\AI-Apps\\ComfyUI_windows_portable\\ComfyUI\\input";
  return fs.existsSync(legacy) ? legacy : path.join(storagePaths().cacheRoot, "ComfyInput");
}

function comfyUpscaleRoot() {
  const legacy = "C:\\AI-Apps\\ComfyUI_windows_portable\\ComfyUI\\models\\upscale_models";
  return fs.existsSync(legacy) ? legacy : path.join(storagePaths().modelsRoot, "upscale_models");
}

function modelCenterConfigPath() {
  return path.join(app.getPath("userData"), "models.json");
}

function readModelCenterConfig() {
  return loadModelCenterConfig(modelCenterConfigPath());
}

function decryptApiKey(encrypted) {
  if (!encrypted || !safeStorage.isEncryptionAvailable()) return "";
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  } catch {
    return "";
  }
}

function encryptApiKey(value) {
  if (!value) return "";
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure operating-system storage is unavailable; the API key was not saved.");
  }
  return safeStorage.encryptString(value).toString("base64");
}

function nativeImageWorkerPath() {
  const root = appRoot.includes("app.asar")
    ? appRoot.replace("app.asar", "app.asar.unpacked")
    : appRoot;
  return path.join(root, "src", "native_image_engine.py");
}

function referenceComposerPath() {
  const root = appRoot.includes("app.asar")
    ? appRoot.replace("app.asar", "app.asar.unpacked")
    : appRoot;
  return path.join(root, "src", "compose_references.py");
}

function visionImagePreparerPath() {
  const root = appRoot.includes("app.asar")
    ? appRoot.replace("app.asar", "app.asar.unpacked")
    : appRoot;
  return path.join(root, "src", "prepare_vision_image.py");
}

function prepareVisionImage(sourcePath, outputPath, maxSide = 1024) {
  const python = storagePaths().nativePython;
  const needsPhysicalCopy = String(sourcePath).includes("app.asar");
  const physicalSource = needsPhysicalCopy
    ? `${outputPath}.source${path.extname(sourcePath) || ".jpg"}`
    : sourcePath;
  if (needsPhysicalCopy) fs.copyFileSync(sourcePath, physicalSource);
  return new Promise((resolve, reject) => {
    execFile(
      python,
      [visionImagePreparerPath(), physicalSource, outputPath, String(maxSide)],
      { timeout: 60000, windowsHide: true },
      (error) => {
        if (needsPhysicalCopy) fs.rmSync(physicalSource, { force: true });
        error ? reject(error) : resolve(outputPath);
      }
    );
  });
}

function composeReferenceSheet(referencePaths, outputPath) {
  const python = storagePaths().nativePython;
  return new Promise((resolve, reject) => {
    execFile(
      python,
      [referenceComposerPath(), outputPath, ...referencePaths.slice(0, 2)],
      { timeout: 60000, windowsHide: true },
      (error) => error ? reject(error) : resolve(outputPath)
    );
  });
}

function nativeImageEngineAvailable() {
  const storage = storagePaths();
  return fs.existsSync(storage.nativePython)
    && fs.existsSync(nativeImageWorkerPath())
    && fs.existsSync(path.join(storage.nativePackages, "diffusers", "__init__.py"))
    && fs.existsSync(path.join(storage.modelsRoot, "checkpoints", "animagine-xl-4.0.safetensors"));
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp"
};

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 40 * 1024 * 1024) {
        req.destroy(new Error("Request body is too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function readComfyProfile(config) {
  const raw = config?.imageBackend ?? {};
  const image = raw?.image ?? {};
  return {
    baseUrl: String(raw.baseUrl ?? "http://127.0.0.1:8188").replace(/\/$/, ""),
    workflowPath: String(image.workflowPath ?? path.join(appRoot, "workflows", "animagine-text-to-image-api.json")),
    referenceWorkflowPath: String(image.referenceWorkflowPath ?? path.join(appRoot, "workflows", "animagine-reference-api.json")),
    fluxWorkflowPath: String(image.fluxWorkflowPath ?? path.join(appRoot, "workflows", "flux2-klein-text-api.json")),
    fluxReferenceWorkflowPath: String(image.fluxReferenceWorkflowPath ?? path.join(appRoot, "workflows", "flux2-klein-reference-api.json")),
    promptNodeId: String(image.promptNodeId ?? "6"),
    promptInputName: String(image.promptInputName ?? "text"),
    outputNodeId: String(image.outputNodeId ?? "9"),
    fluxOutputNodeId: String(image.fluxOutputNodeId ?? "12"),
    referenceImageNodeId: String(image.referenceImageNodeId ?? "12"),
    pollIntervalMs: Number(image.pollIntervalMs ?? 1000),
    timeoutMs: Math.max(1200000, Number(image.timeoutMs ?? 1200000))
  };
}

function imageRoute(prompt, settings = {}) {
  const style = String(settings?.style ?? "auto").toLowerCase();
  const value = String(prompt ?? "").toLowerCase();
  if (style === "anime" || style === "illustration" || /(动漫|二次元|国漫|有兽焉|插画|拟人|兽人|anime|manga|anthropomorphic|cartoon)/i.test(value)) {
    return "anime";
  }
  if (style === "photo" || style === "natural" || /(写实|真实|摄影|照片|野生动物|photoreal|realistic|wildlife|portrait)/i.test(value)) {
    return "realistic";
  }
  return "anime";
}

function knownCharacterFacts(prompt) {
  const value = String(prompt ?? "");
  const facts = [];
  if (/(辟邪|bixie|pixiu)/i.test(value)) {
    facts.push("Bixie from 有兽焉: small fluffy white pixiu, crimson facial and body markings, red tail, lime-green eyes, bronze horn, calm expression");
  }
  if (/(天禄|tianlu)/i.test(value)) {
    facts.push("Tianlu from 有兽焉: small fluffy white pixiu, cyan forehead curls and body markings, cyan tail, golden horn, golden-green eyes, cheerful expression");
  }
  return facts.length ? `Identity lock: ${facts.join("; ")}. Do not merge or substitute the characters.` : "";
}

function referenceLockPrompt(prompt, visualSpec = "", identityPrompt = prompt) {
  return [
    "REFERENCE-LOCKED CHARACTER EDIT.",
    "Reference image is authoritative for identity. Preserve the exact silhouette, facial geometry, proportions, palette, line weight, rendering style, and signature markings.",
    "Change only the requested pose, expression, action, camera, clothing, or background.",
    /(辟邪|bixie|pixiu)/i.test(identityPrompt) && /(天禄|tianlu)/i.test(identityPrompt)
      ? "Exactly two distinct characters together in one shared scene, both fully visible. No split screen, panels, character sheet, duplicate, clone, or merged body."
      : "Exactly one main subject. No companion, duplicate, clone, character sheet, collage, or generic redesign.",
    knownCharacterFacts(identityPrompt),
    visualSpec ? `Vision inspection of the reference: ${visualSpec}` : "",
    String(prompt ?? "").trim(),
    "Do not beautify, chibify, modernize, add decorative detail, or replace the character with a namesake."
  ].filter(Boolean).join(" ");
}

function textOnlyImagePrompt(prompt, route) {
  const cleaned = String(prompt ?? "").trim();
  if (route === "realistic") {
    return `${cleaned}, photorealistic, natural lighting, realistic material and skin or fur detail, professional photography, sharp subject, no text, no watermark`;
  }
  if (route === "general") {
    return `${cleaned}, coherent cinematic concept art, strong composition, atmospheric depth, faithful requested color palette, fine detail, no text, no watermark`;
  }
  return `${cleaned}, one clear main subject, coherent scene, masterpiece, best quality, anime illustration, clean lineart, expressive character design, cel shading, vivid but coherent colors, no text, no watermark`;
}

function routedImagePrompt(prompt, route, visualSpec = "", referenceLocked = false, identityPrompt = prompt) {
  if (!referenceLocked) return textOnlyImagePrompt(prompt, route);
  return `${referenceLockPrompt(prompt, visualSpec, identityPrompt)}, masterpiece, best quality, anime illustration, clean lineart, expressive character design, cel shading, vivid but coherent colors, no text, no watermark`;
}

function routedFluxPrompt(prompt, visualSpec = "", referenceLocked = false, identityPrompt = prompt) {
  const cleaned = String(prompt ?? "").trim();
  if (!referenceLocked) {
    return `${cleaned} One clear main subject. High-quality concept illustration, coherent composition, clear subject silhouette, expressive pose, refined materials, controlled lighting, no text, no watermark.`;
  }
  if (/(辟邪|bixie|pixiu)/i.test(identityPrompt) && /(天禄|tianlu)/i.test(identityPrompt)) {
    return [
      "Preserve exactly the two Fabulous Beasts characters from the reference.",
      "Bixie with crimson markings stays on the left; Tianlu with cyan markings stays on the right.",
      cleaned,
      "Show both distinct characters full body in one continuous scene.",
      "Keep their exact official anime faces, horns, eyes, markings, tails, proportions and clean line style.",
      "No third character, collage, panels, text, merged identity or redesign."
    ].join(" ");
  }
  return `${referenceLockPrompt(cleaned, visualSpec, identityPrompt)} High-quality concept illustration, coherent composition, clear subject silhouette, expressive pose, refined materials, controlled lighting, no text, no watermark.`;
}

function imageEngine(settings = {}) {
  const requested = String(settings?.engine ?? "auto").toLowerCase();
  if (requested === "auto") return "auto";
  if (["ssd1b", "ssd-1b", "fast", "sdxl"].includes(requested)) return "ssd1b";
  if (["realistic", "photo", "portrait", "juggernaut"].includes(requested)) return "realistic";
  return requested === "flux" || requested === "flux2" ? "flux2" : "anime";
}

function imageDimensions(settings = {}) {
  const dimensions = {
    square: [768, 768],
    landscape: [768, 432],
    portrait: [432, 768],
    classic: [768, 576],
    vertical: [576, 768],
    photo: [768, 512]
  };
  const [width, height] = dimensions[String(settings?.aspect ?? "landscape")] ?? dimensions.landscape;
  return { width, height };
}

function imageOutputDimensions(settings = {}, tier = "4k") {
  const dimensions = tier === "2k" ? {
    square: [2048, 2048],
    landscape: [2560, 1440],
    portrait: [1440, 2560],
    classic: [2560, 1920],
    vertical: [1920, 2560],
    photo: [2560, 1707]
  } : {
    square: [3840, 3840],
    landscape: [3840, 2160],
    portrait: [2160, 3840],
    classic: [3840, 2880],
    vertical: [2880, 3840],
    photo: [3840, 2560]
  };
  const [width, height] = dimensions[String(settings?.aspect ?? "landscape")] ?? dimensions.landscape;
  return { width, height };
}

function imageSteps(settings = {}, engine = "anime") {
  const values = engine === "flux2"
    ? { standard: 5, high: 8, ultra: 12 }
    : engine === "ssd1b"
      ? { standard: 6, high: 10, ultra: 14 }
    : { standard: 10, high: 22, ultra: 30 };
  return values[String(settings?.quality ?? "high")] ?? values.high;
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isImageUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !/\.(?:svg|gif)(?:$|\?)/i.test(url.pathname);
  } catch {
    return false;
  }
}

async function searchBingImageCandidates(query) {
  const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2`;
  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 VELA/1.0",
      Accept: "text/html,application/xhtml+xml"
    },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Reference image search failed (${response.status}).`);
  const html = await response.text();
  const candidates = [];
  const patterns = [
    /murl(?:&quot;|"):\s*(?:&quot;|")(.*?)(?:&quot;|")/g,
    /"murl":"(.*?)"/g
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const url = decodeHtml(match[1]).replace(/\\u002f/g, "/");
      if (isImageUrl(url) && !candidates.includes(url)) candidates.push(url);
      if (candidates.length >= 8) break;
    }
    if (candidates.length >= 8) break;
  }
  return candidates;
}

async function searchReferenceImage(prompt, spec = null) {
  const cleaned = String(prompt).trim().slice(0, 180);
  const queries = spec ? buildReferenceQueries(spec) : [
    `"${cleaned}" official character sheet reference illustration`,
    `${cleaned} 角色设定图 官方 立绘 正面`,
    `${cleaned} character design sheet full body reference`
  ];
  const batches = await Promise.allSettled(queries.map(searchBingImageCandidates));
  const candidates = [...new Set(batches.flatMap((batch) => batch.status === "fulfilled" ? batch.value : []))];
  if (!candidates.length) throw new Error("No usable reference image was found.");
  const terms = String(prompt).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 1);
  return candidates.sort((left, right) => {
    const score = (value) => terms.reduce((total, term) => total + (value.toLowerCase().includes(term) ? 3 : 0), 0);
    return score(right) - score(left);
  });
}

async function availableOllamaVisionModel() {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return "";
    const models = await response.json();
    const names = Array.isArray(models?.models) ? models.models.map((item) => String(item?.name ?? "")) : [];
    return names.find((name) => /^qwen2\.5vl:3b$/i.test(name))
      ?? names.find((name) => /^qwen3-vl:8b$/i.test(name))
      ?? names.find((name) => /^moondream(?::|$)/i.test(name))
      ?? "";
  } catch {
    return "";
  }
}

async function availableOllamaPromptModel() {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return "";
    const models = await response.json();
    const names = Array.isArray(models?.models) ? models.models.map((item) => String(item?.name ?? "")) : [];
    return names.find((name) => /^qwen3:8b$/i.test(name))
      ?? names.find((name) => /^qwen2\.5-coder:7b$/i.test(name))
      ?? "";
  } catch {
    return "";
  }
}

function knownCharacterScenePrompt(prompt) {
  const value = String(prompt ?? "");
  const parts = [];
  if (/(合照|合影|group photo|portrait together)/i.test(value)) parts.push("friendly group portrait, side by side, both characters fully visible");
  if (/(站立|站在|站着|standing)/i.test(value)) parts.push("standing naturally");
  if (/(奔跑|跑|running)/i.test(value)) parts.push("running together");
  if (/(飞|flying)/i.test(value)) parts.push("flying through the scene");
  if (/(城市|街道|city|street)/i.test(value)) parts.push("in a coherent modern city street");
  if (/(咖啡厅|咖啡馆|cafe|coffee shop)/i.test(value)) parts.push("inside a cozy cafe");
  if (/(喝咖啡|饮用咖啡|drinking coffee)/i.test(value)) parts.push("drinking a cup of coffee");
  if (/(冬装|冬季服装|冬天穿着|winter clothing|winter outfit)/i.test(value)) parts.push("wearing tasteful winter clothing");
  if (/(森林|forest)/i.test(value)) parts.push("in a quiet forest");
  if (/(竹林|竹子|bamboo)/i.test(value)) parts.push("together in one continuous bamboo forest scene");
  if (/(黄昏|日落|sunset)/i.test(value)) parts.push("at warm sunset");
  if (/(夜景|夜晚|night)/i.test(value)) parts.push("at night");
  return parts.join(", ") || "a clean character illustration matching the requested action and setting";
}

async function prepareImagePrompt(prompt, spec = null) {
  const cleaned = String(prompt ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned || !/[\u3400-\u9fff]/u.test(cleaned)) return cleaned;
  if (Array.isArray(spec?.knownCharacters) && spec.knownCharacters.length) {
    return knownCharacterScenePrompt(cleaned);
  }
  const model = await availableOllamaPromptModel();
  if (!model) return cleaned;
  return runWithDeadline(async (signal) => {
    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Prompt translation is an optimization, never a reason to hold the UI.
      // Fall back to the original prompt quickly when the local chat model is cold.
      signal,
      body: JSON.stringify({
        model,
        keep_alive: 0,
        stream: false,
        think: false,
        options: { temperature: 0.1 },
        messages: [{
          role: "system",
          content: "Return JSON only: {\"scene\":\"...\"}. Translate the visual request into at most 32 English words. Preserve subject count, action, setting, camera, colors and style. Keep proper names unchanged. Never explain, reinterpret folklore, or add objects."
        }, {
          role: "user",
          content: cleaned.slice(0, 1800)
        }]
      })
    });
    if (!response.ok) return cleaned;
    const payload = await response.json();
    const raw = String(payload?.message?.content ?? "")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .trim();
    let translated = "";
    try {
      translated = String(JSON.parse(raw)?.scene ?? "");
    } catch {
      translated = raw;
    }
    translated = translated.replace(/[*#`]/g, "").replace(/\s+/g, " ").trim();
    const words = translated.split(" ").filter(Boolean);
    return translated && words.length <= 36 ? translated : cleaned;
  }, 6000, cleaned);
}

async function inspectReferenceImage(localPath, prompt) {
  const model = await availableOllamaVisionModel();
  if (!model || !localPath || !fs.existsSync(localPath)) return "";
  const stat = fs.statSync(localPath);
  if (!stat.isFile() || stat.size > 12 * 1024 * 1024) return "";
  const image = fs.readFileSync(localPath).toString("base64");
  const response = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      model,
      keep_alive: 0,
      stream: false,
      messages: [{
        role: "user",
        content: `Inspect this character reference for an image generator. Identify only stable visual identity traits: species, silhouette, face shape, eye colors and gradient, horns/ears, fur or hair colors, markings, tail, costume, line style, and distinctive asymmetry. Do not invent a name. Keep it under 180 words. The requested subject is: ${String(prompt).slice(0, 180)}`,
        images: [image]
      }]
    })
  });
  if (!response.ok) throw new Error(`Vision inspection failed (${response.status}).`);
  const payload = await response.json();
  return String(payload?.message?.content ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);
}

async function evaluateReferenceImage(localPath, prompt) {
  const model = await availableOllamaVisionModel();
  if (!model || !localPath || !fs.existsSync(localPath)) return { score: 50, visualSpec: "" };
  const stat = fs.statSync(localPath);
  if (!stat.isFile() || stat.size > 12 * 1024 * 1024) return { score: 0, visualSpec: "" };
  const image = fs.readFileSync(localPath).toString("base64");
  try {
    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model,
        keep_alive: 0,
        stream: false,
        format: "json",
        options: { temperature: 0 },
        messages: [{
          role: "user",
          content: `Evaluate whether this is a useful visual reference for: ${String(prompt).slice(0, 220)}. Return JSON only with {"score":0-100,"visualSpec":"stable visible identity or location traits under 160 words"}. Penalize unrelated subjects, fan redesigns, collages, text-heavy pages, screenshots and low-resolution thumbnails.`,
          images: [image]
        }]
      })
    });
    if (!response.ok) return { score: 0, visualSpec: "" };
    const payload = await response.json();
    const parsed = JSON.parse(String(payload?.message?.content ?? "{}"));
    return {
      score: Math.max(0, Math.min(100, Number(parsed?.score) || 0)),
      visualSpec: String(parsed?.visualSpec ?? "").replace(/\s+/g, " ").trim().slice(0, 1200)
    };
  } catch {
    return { score: 0, visualSpec: "" };
  }
}

async function evaluateGeneratedImage(localPath, prompt, spec, referencePaths = []) {
  const model = await availableOllamaVisionModel();
  if (!model || !localPath || !fs.existsSync(localPath)) {
    return { available: false, score: null, issues: [], summary: "Local visual review unavailable." };
  }
  const paths = [localPath, ...referencePaths.filter((item) => item && fs.existsSync(item)).slice(0, 2)];
  const reviewDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "vela-vision-review-"));
  const expectedCount = Number(spec?.expectedSubjectCount) || 1;
  try {
    const preparedPaths = await Promise.all(paths.map((item, index) => (
      prepareVisionImage(item, path.join(reviewDirectory, `review-${index + 1}.jpg`), 1024)
    )));
    const images = preparedPaths.map((item) => fs.readFileSync(item).toString("base64"));
    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({
        model,
        keep_alive: 0,
        stream: false,
        format: "json",
        options: { temperature: 0 },
        messages: [{
          role: "user",
          content: [
            `Image 1 is a generated result for: ${String(prompt).slice(0, 260)}.`,
            images.length > 1 ? "The remaining images are identity references." : "No identity reference is supplied.",
            `Expected subject count: ${expectedCount}.`,
            "Reject abstract color blocks, severe stretching, collage layouts, missing subjects, wrong species, merged characters, changed colors/markings, unreadable anatomy, or an image that merely copies one reference while ignoring the request.",
            "Return JSON only: {\"score\":0-100,\"subjectMatch\":0-100,\"compositionMatch\":0-100,\"referenceMatch\":0-100,\"issues\":[\"specific observed problem\"],\"summary\":\"specific one-sentence verdict\"}. Use an empty issues array only when the result is acceptable; never copy the schema placeholder text."
          ].join(" "),
          images
        }]
      })
    });
    if (!response.ok) {
      const detail = String(await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
      return { available: false, score: null, issues: [], summary: `Visual review failed (${response.status})${detail ? `: ${detail}` : "."}` };
    }
    const payload = await response.json();
    const parsed = parseVisualReviewResponse(payload?.message?.content);
    if (!parsed) {
      return { available: false, score: null, issues: [], summary: "Local visual review returned an unreadable response." };
    }
    return {
      available: true,
      ...parsed
    };
  } catch (error) {
    return { available: false, score: null, issues: [], summary: error instanceof Error ? error.message : String(error) };
  } finally {
    fs.rmSync(reviewDirectory, { recursive: true, force: true });
  }
}

function quarantineRejectedImage(outputPath) {
  if (!outputPath || !fs.existsSync(outputPath)) return null;
  const root = path.dirname(outputPath);
  const rejectedRoot = path.join(root, "Rejected");
  fs.mkdirSync(rejectedRoot, { recursive: true });
  const parsed = path.parse(outputPath);
  const baseDestination = path.join(rejectedRoot, path.basename(outputPath));
  const destination = fs.existsSync(baseDestination)
    ? path.join(rejectedRoot, `${parsed.name}-${Date.now()}${parsed.ext}`)
    : baseDestination;
  fs.renameSync(outputPath, destination);
  return destination;
}

function memoryIndexPath() {
  return path.join(storagePaths().characterMemoryRoot, "index.json");
}

function readCharacterMemory() {
  try {
    const parsed = JSON.parse(fs.readFileSync(memoryIndexPath(), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizedMemoryPrompt(prompt) {
  return String(prompt ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 240);
}

function findCharacterMemory(prompt) {
  const normalized = normalizedMemoryPrompt(prompt);
  if (!normalized) return null;
  return readCharacterMemory()
    .filter((item) => item?.prompt && item?.path && fs.existsSync(item.path))
    .sort((left, right) => Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0))
    .find((item) => normalized.includes(String(item.prompt).slice(0, 100)) || String(item.prompt).includes(normalized.slice(0, 100))) ?? null;
}

function findKnownReference(prompt) {
  return findKnownReferences(prompt)[0] ?? null;
}

function findKnownReferences(prompt) {
  const value = String(prompt ?? "");
  const requestsBixie = /(辟邪|bixie|pixiu)/i.test(value);
  const requestsTianlu = /(天禄|tianlu)/i.test(value);
  if (requestsBixie && requestsTianlu) {
    const bundledPair = path.join(appRoot, "references", "tianlu_bixie_pair_ref.jpg");
    const installedPair = path.join(comfyInputRoot(), "tianlu_bixie_pair_ref.jpg");
    const pairPath = [installedPair, bundledPair].find((candidate) => fs.existsSync(candidate));
    if (pairPath) return [{ pattern: /(辟邪|bixie|pixiu).*(天禄|tianlu)|(天禄|tianlu).*(辟邪|bixie|pixiu)/i, path: pairPath }];
  }
  const known = [
    {
      pattern: /(辟邪|bixie|pixiu)/i,
      path: path.join(comfyInputRoot(), "bixie_ref.png")
    },
    {
      pattern: /(天禄|tianlu)/i,
      path: path.join(comfyInputRoot(), "tianlu_ref.png")
    }
  ];
  return known.filter((item) => item.pattern.test(value) && fs.existsSync(item.path));
}

function saveCharacterMemory(prompt, sourcePath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) return null;
  fs.mkdirSync(storagePaths().characterMemoryRoot, { recursive: true });
  const digest = crypto.createHash("sha256").update(normalizedMemoryPrompt(prompt)).digest("hex").slice(0, 20);
  const extension = path.extname(sourcePath).toLowerCase() === ".png" ? ".png" : ".jpg";
  const destination = path.join(storagePaths().characterMemoryRoot, `${digest}${extension}`);
  fs.copyFileSync(sourcePath, destination);
  const entries = readCharacterMemory().filter((item) => item?.path !== destination);
  entries.push({
    prompt: normalizedMemoryPrompt(prompt),
    path: destination,
    updatedAt: Date.now()
  });
  fs.writeFileSync(memoryIndexPath(), JSON.stringify(entries.slice(-100), null, 2), "utf8");
  return destination;
}

async function downloadReferenceImage(url, tempDirectory) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 VELA/1.0", Accept: "image/avif,image/webp,image/png,image/jpeg,image/*" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Reference image download failed (${response.status}).`);
  const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error("Reference result is not an image.");
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > 12 * 1024 * 1024) throw new Error("Reference image is too large.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 12 * 1024 * 1024) throw new Error("Reference image size is invalid.");
  const extension = contentType.includes("png") ? ".png" : ".jpg";
  const filePath = path.join(tempDirectory, `reference-${crypto.randomUUID()}${extension}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

async function uploadReferenceImage(baseUrl, filePath) {
  const form = new FormData();
  form.append("image", new Blob([fs.readFileSync(filePath)], { type: "image/png" }), path.basename(filePath));
  form.append("overwrite", "true");
  const response = await fetch(`${baseUrl}/upload/image`, { method: "POST", body: form });
  if (!response.ok) throw new Error(`ComfyUI reference upload failed (${response.status}).`);
  const payload = await response.json();
  const name = String(payload?.name ?? "");
  if (!name) throw new Error("ComfyUI did not return an uploaded reference filename.");
  return name;
}

function removeUploadedReference(uploadedName) {
  const inputRoot = path.resolve(comfyInputRoot());
  const candidate = path.resolve(inputRoot, uploadedName);
  if (!isInside(candidate, inputRoot)) return;
  if (fs.existsSync(candidate)) fs.rmSync(candidate, { force: true });
}

async function createReferenceContext(profile, prompt, attachments = [], requiredWorkflowPath = profile.referenceWorkflowPath) {
  if (!fs.existsSync(requiredWorkflowPath)) throw new Error("Reference workflow is not installed.");
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "vela-reference-"));
  const uploadedNames = [];
  try {
    let localPath;
    let localPaths = [];
    let source = "search";
    const attachment = attachments.find((item) => item?.type === "image" && item?.content);
    if (attachment) {
      const mime = String(attachment.mimeType ?? "image/png").split(";", 1)[0];
      const extension = mime.includes("jpeg") || mime.includes("jpg") ? ".jpg" : ".png";
      localPath = path.join(tempDirectory, `user-reference${extension}`);
      fs.writeFileSync(localPath, Buffer.from(String(attachment.content), "base64"));
      localPaths = [localPath];
      source = "user";
    }
    const known = localPath ? [] : findKnownReferences(prompt);
    if (known.length) {
      if (known.length > 1) {
        localPaths = known.slice(0, 2).map((item, index) => {
          const destination = path.join(tempDirectory, `known-reference-${index + 1}${path.extname(item.path) || ".png"}`);
          fs.copyFileSync(item.path, destination);
          return destination;
        });
        localPath = localPaths[0];
      } else {
        localPath = path.join(tempDirectory, `known-reference${path.extname(known[0].path) || ".png"}`);
        fs.copyFileSync(known[0].path, localPath);
        localPaths = [localPath];
      }
      source = "known";
    }
    const memory = localPath ? null : findCharacterMemory(prompt);
    if (memory) {
      localPath = path.join(tempDirectory, `memory-reference${path.extname(memory.path) || ".png"}`);
      fs.copyFileSync(memory.path, localPath);
      localPaths = [localPath];
      source = "memory";
    }
    const candidates = localPath ? [] : await searchReferenceImage(prompt);
    let lastError;
    const evaluatedCandidates = [];
    for (const candidate of candidates.slice(0, 6)) {
      try {
        const candidatePath = await downloadReferenceImage(candidate, tempDirectory);
        const evaluated = await evaluateReferenceImage(candidatePath, prompt);
        evaluatedCandidates.push({ path: candidatePath, ...evaluated });
        if (evaluated.score >= 78) break;
      } catch (error) {
        lastError = error;
      }
    }
    const selected = selectReferenceCandidate(evaluatedCandidates);
    if (selected) {
      localPath = selected.path;
      localPaths = [selected.path];
      source = selected.confidence === "verified" ? "verified-search" : "weak-search";
    }
    if (!localPath) throw lastError ?? new Error("No downloadable reference image was found.");
    if (!localPaths.length) localPaths = [localPath];
    for (const referencePath of localPaths) {
      uploadedNames.push(await uploadReferenceImage(profile.baseUrl, referencePath));
    }
    const visualSpecs = await Promise.all(localPaths.map(async (referencePath) => {
      try {
        return await inspectReferenceImage(referencePath, prompt);
      } catch (error) {
        console.warn(`[VELA] Vision inspection unavailable: ${error instanceof Error ? error.message : String(error)}`);
        return "";
      }
    }));
    return {
      uploadedName: uploadedNames[0],
      uploadedNames,
      tempDirectory,
      localPath,
      localPaths,
      source,
      visualSpec: visualSpecs.filter(Boolean).join(" Separate identity reference: ")
    };
  } catch (error) {
    uploadedNames.forEach(removeUploadedReference);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
    throw error;
  }
}

function comfyViewUrl(profile, item) {
  const query = new URLSearchParams({
    filename: String(item.filename),
    subfolder: String(item.subfolder ?? ""),
    type: String(item.type ?? "output")
  });
  return `${profile.baseUrl}/view?${query.toString()}`;
}

function comfyOutputPath(item) {
  if (String(item.type ?? "output") !== "output") return null;
  const candidate = path.resolve(
    storagePaths().comfyOutputRoot,
    String(item.subfolder ?? ""),
    String(item.filename ?? "")
  );
  if (!isInside(candidate, storagePaths().comfyOutputRoot) || !fs.existsSync(candidate)) return null;
  return candidate;
}

async function downloadComfyImage(profile, item, tempDirectory) {
  const response = await fetch(comfyViewUrl(profile, item), { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`ComfyUI output download failed (${response.status}).`);
  const filePath = path.join(tempDirectory, `generated-${crypto.randomUUID()}.png`);
  fs.writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
  return filePath;
}

async function upscaleGeneratedOutputs(profile, images, settings, route) {
  const quality = String(settings?.quality ?? "high").toLowerCase();
  if (quality === "standard") {
    const base = imageDimensions(settings);
    return { images, ...base, resolution: "HD", upscaled: false };
  }
  const modelName = route === "anime" ? "RealESRGAN_x4plus_anime_6B.pth" : "RealESRGAN_x4plus.pth";
  const modelPath = path.join(comfyUpscaleRoot(), modelName);
  const useAiUpscaler = quality === "ultra" && fs.existsSync(modelPath);
  const targets = imageOutputDimensions(settings, useAiUpscaler ? "4k" : "2k");
  if (!images.length) {
    return { images, ...targets, resolution: "base", upscaled: false };
  }

  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "vela-upscale-"));
  const uploadedNames = [];
  try {
    throwIfImageCancelled();
    const resultImages = [];
    for (const source of images) {
      const sourcePath = await downloadComfyImage(profile, source, tempDirectory);
      const uploadedName = await uploadReferenceImage(profile.baseUrl, sourcePath);
      uploadedNames.push(uploadedName);
      const workflow = useAiUpscaler ? {
        "1": {
          inputs: { image: uploadedName },
          class_type: "LoadImage"
        },
        "2": {
          inputs: { model_name: modelName },
          class_type: "UpscaleModelLoader"
        },
        "3": {
          inputs: { upscale_model: ["2", 0], image: ["1", 0] },
          class_type: "ImageUpscaleWithModel"
        },
        "4": {
          inputs: {
            image: ["3", 0],
            upscale_method: "lanczos",
            width: targets.width,
            height: targets.height,
            crop: "disabled"
          },
          class_type: "ImageScale"
        },
        "5": {
          inputs: { filename_prefix: "VELA-4K", images: ["4", 0] },
          class_type: "SaveImage"
        }
      } : {
        "1": {
          inputs: { image: uploadedName },
          class_type: "LoadImage"
        },
        "4": {
          inputs: {
            image: ["1", 0],
            upscale_method: "lanczos",
            width: targets.width,
            height: targets.height,
            crop: "disabled"
          },
          class_type: "ImageScale"
        },
        "5": {
          inputs: { filename_prefix: "VELA-2K", images: ["4", 0] },
          class_type: "SaveImage"
        }
      };
      const queued = await fetch(`${profile.baseUrl}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow, client_id: `vela-upscale-${crypto.randomUUID()}` })
      });
      if (!queued.ok) throw new Error(`ComfyUI upscale queue failed (${queued.status}).`);
      const promptId = String((await queued.json())?.prompt_id ?? "");
      if (!promptId) throw new Error("ComfyUI did not return an upscale prompt id.");
      if (activeImageJob) {
        activeImageJob.promptId = promptId;
        activeImageJob.phase = "upscaling";
        throwIfImageCancelled(activeImageJob);
      }
      const deadline = Date.now() + profile.timeoutMs;
      while (Date.now() < deadline) {
        throwIfImageCancelled(activeImageJob);
        const history = await fetch(`${profile.baseUrl}/history/${encodeURIComponent(promptId)}`);
        if (history.ok) {
          const record = (await history.json())?.[promptId];
          const output = record?.outputs?.["5"]?.images;
          if (Array.isArray(output) && output.length) {
            resultImages.push(...output.filter((item) => item?.filename));
            break;
          }
          if (record?.status?.status_str === "error") {
            throw comfyExecutionError(record, "ComfyUI reported an upscale error");
          }
        }
        await new Promise((resolve) => setTimeout(resolve, Math.max(300, profile.pollIntervalMs)));
      }
      if (!resultImages.length) throw new Error("ComfyUI upscale timed out.");
    }
    return {
      images: resultImages,
      ...targets,
      resolution: useAiUpscaler ? "4K" : "2K",
      upscaled: true
    };
  } finally {
    uploadedNames.forEach(removeUploadedReference);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

function throwIfImageCancelled(job = activeImageJob) {
  if (job?.cancelled) throw new Error("Image generation cancelled.");
}

function setImageJobPhase(job, phase) {
  if (!job || job.phase === phase) return;
  job.phase = phase;
  job.phaseStartedAt = Date.now();
}

function comfyExecutionError(record, fallbackMessage) {
  const messages = Array.isArray(record?.status?.messages) ? [...record.status.messages].reverse() : [];
  for (const entry of messages) {
    const [event, detail] = Array.isArray(entry) ? entry : [];
    if (event === "execution_interrupted") {
      return new Error("ComfyUI generation was interrupted. Wait for the current task to stop before starting another image.");
    }
    if (event === "execution_error") {
      const reason = String(detail?.exception_message ?? detail?.exception_type ?? "").trim();
      const node = String(detail?.node_type ?? detail?.node_id ?? "").trim();
      return new Error(`${fallbackMessage}${node ? ` (${node})` : ""}${reason ? `: ${reason}` : ""}`);
    }
  }
  return new Error(fallbackMessage);
}

async function interruptActiveImageJob() {
  if (!activeImageJob) return false;
  activeImageJob.cancelled = true;
  activeImageJob.controller?.abort(new Error("Image generation cancelled."));
  if (activeImageJob.worker && !activeImageJob.worker.killed) {
    activeImageJob.worker.kill();
    return true;
  }
  try {
    if (activeImageJob.promptId) {
      const profile = activeImageJob.baseUrl;
      await fetch(`${profile}/interrupt`, { method: "POST", signal: AbortSignal.timeout(2500) });
    }
  } catch {
    // The local job is still marked cancelled; ComfyUI may already have finished.
  }
  return true;
}

async function generateNativeImage(prompt, settings = {}, attachments = []) {
  if (!nativeImageEngineAvailable()) {
    throw new Error("VELA native image engine is not installed correctly.");
  }
  const spec = analyzeImageRequest(prompt, settings, attachments);
  const engine = spec.engine === "flux2" ? "anime" : spec.engine;
  const jobId = crypto.randomUUID();
  const imageJob = {
    promptId: `native-${jobId}`,
    phase: "analyzing-request",
    startedAt: Date.now(),
    phaseStartedAt: Date.now(),
    workflow: publicWorkflowSummary(spec),
    cancelled: false,
    worker: null,
    controller: new AbortController()
  };
  activeImageJob = imageJob;
  let referenceDirectory = "";
  try {
    setImageJobPhase(imageJob, "compiling-spec");
    const preparedPrompt = await prepareImagePrompt(prompt, spec);
    throwIfImageCancelled(imageJob);
    let nativeAttachments = attachments.filter((item) => item?.type === "image" && item?.content).slice(0, 2);
    const localReferencePaths = [];
    let visualSpec = "";
    let referenceSource = nativeAttachments.length ? "user" : "";
    let referenceScore = nativeAttachments.length ? 100 : null;
    const wantsReference = spec.needsReference && settings?.reference !== "off";
    if (wantsReference && !nativeAttachments.length) {
      setImageJobPhase(imageJob, "reference-search");
      referenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "vela-native-reference-"));
      let localPath = "";
      const known = findKnownReferences(prompt);
      const memory = known.length ? null : findCharacterMemory(prompt);
      if (known.length || memory) {
        const sources = known.length ? known.map((item) => item.path) : [memory.path];
        const copied = sources.map((sourcePath, index) => {
          const destination = path.join(referenceDirectory, `reference-${index + 1}${path.extname(sourcePath) || ".png"}`);
          fs.copyFileSync(sourcePath, destination);
          return destination;
        });
        localPath = copied[0];
        localReferencePaths.push(...copied);
        referenceSource = known.length ? "known" : "memory";
        referenceScore = 100;
      } else {
        let lastError;
        let candidates = [];
        try {
          candidates = await searchReferenceImage(prompt, spec);
        } catch (error) {
          // Online reference discovery is an optional fidelity aid. Keep the
          // generation path available when search has no usable result or the
          // remote source is temporarily unavailable.
          lastError = error;
        }
        const evaluatedCandidates = [];
        for (const candidate of candidates.slice(0, 6)) {
          throwIfImageCancelled(imageJob);
          try {
            const candidatePath = await downloadReferenceImage(candidate, referenceDirectory);
            setImageJobPhase(imageJob, "reference-validation");
            const evaluated = await evaluateReferenceImage(candidatePath, prompt);
            evaluatedCandidates.push({ path: candidatePath, ...evaluated });
            if (evaluated.score >= 78) break;
          } catch (error) {
            lastError = error;
          }
        }
        const best = selectReferenceCandidate(evaluatedCandidates);
        if (best) {
          localPath = best.path;
          visualSpec = best.visualSpec;
          referenceScore = best.score;
          referenceSource = best.confidence === "verified" ? "verified-search" : "weak-search";
          localReferencePaths.push(best.path);
        }
        // Reference discovery improves identity fidelity, but it must never become
        // a hard gate that prevents the user from receiving an image. Search and
        // validation can legitimately fail because a site is unavailable, blocks
        // downloads, or has no usable result. Continue with the compiled identity
        // traits and expose the fallback in result metadata instead.
        if (!localPath) {
          referenceSource = "text-fallback";
          if (lastError) imageJob.referenceWarning = String(lastError?.message ?? lastError);
        }
      }
      throwIfImageCancelled(imageJob);
      if (localPath && !visualSpec) {
        setImageJobPhase(imageJob, "reference-vision");
        visualSpec = await inspectReferenceImage(localPath, prompt).catch(() => "");
      }
      if (localPath && spec.referenceMode !== "visual-research") {
        const selectedReferences = localReferencePaths.length ? localReferencePaths : [localPath];
        nativeAttachments = selectedReferences.slice(0, 2).map((referencePath) => ({
          type: "image",
          mimeType: path.extname(referencePath).toLowerCase() === ".png" ? "image/png" : "image/jpeg",
          fileName: path.basename(referencePath),
          content: fs.readFileSync(referencePath).toString("base64")
        }));
        if (settings?.memory !== "once" && referenceSource === "verified-search" && Number(referenceScore) >= 68) {
          saveCharacterMemory(prompt, localPath);
        }
      }
    }
    if (nativeAttachments.length && !localReferencePaths.length) {
      if (!referenceDirectory) referenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "vela-native-reference-"));
      nativeAttachments.forEach((attachment, index) => {
        const raw = String(attachment.content ?? "").replace(/^data:[^,]+,/, "");
        if (!raw) return;
        const extension = String(attachment.mimeType ?? "").includes("jpeg") ? ".jpg" : ".png";
        const referencePath = path.join(referenceDirectory, `user-reference-${index + 1}${extension}`);
        fs.writeFileSync(referencePath, Buffer.from(raw, "base64"));
        localReferencePaths.push(referencePath);
      });
    }
    setImageJobPhase(imageJob, "prompt-compilation");
    const nativePrompt = compileImagePrompt(spec, preparedPrompt, visualSpec, nativeAttachments.length > 0);
    imageJob.compiled = {
      engine,
      referenceSource: referenceSource || null,
      referenceScore,
      promptLength: nativePrompt.length
    };
    setImageJobPhase(imageJob, "loading-model");
    if (!(await ensureNativeImageEngine())) throw new Error("VELA native image engine could not start.");
    throwIfImageCancelled(imageJob);
    imageJob.worker = nativeImageProcess;
    const maxAttempts = spec.subjectType === "character" || nativeAttachments.length ? 2 : 1;
    const minimumScore = nativeAttachments.length ? 70 : 55;
    let lastReview = null;
    const fallbackCandidates = [];
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      throwIfImageCancelled(imageJob);
      if (!(await ensureNativeImageEngine())) throw new Error("VELA native image engine could not restart.");
      imageJob.worker = nativeImageProcess;
      setImageJobPhase(imageJob, attempt === 1 ? "generating" : "retrying-quality");
      const response = await fetch(`http://${APP_HOST}:${NATIVE_IMAGE_PORT}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: nativePrompt,
          settings: { ...settings, seed: null, engine, negativePrompt: compileNegativePrompt(spec, settings) },
          attachments: nativeAttachments
        }),
        signal: AbortSignal.any([imageJob.controller.signal, AbortSignal.timeout(1200000)])
      });
      const payload = await response.json();
      if (!payload?.ok) throw new Error(String(payload?.error ?? "Native image generation failed."));
      const outputPath = String(payload?.result?.outputs?.[0]?.path ?? "");
      setImageJobPhase(imageJob, "validating-output");
      await releaseNativeImageEngineForReview(imageJob);
      const requiresSemanticReview = requiresSemanticIdentityReview(spec, nativeAttachments);
      const review = requiresSemanticReview
        ? await evaluateGeneratedImage(outputPath, prompt, spec, localReferencePaths)
        : { available: false, score: null, summary: "Semantic identity review is not required for this subject." };
      lastReview = review;
      const splitPanelDetected = payload?.result?.qualityChecks?.splitPanelDetected === true;
      const accepted = !requiresSemanticReview || !review.available || Number(review.score) >= minimumScore;
      if (accepted) {
        fallbackCandidates.forEach((candidate) => quarantineRejectedImage(candidate.outputPath));
        setImageJobPhase(imageJob, "finalizing-output");
        return {
          ...payload.result,
          requestedEngine: spec.engine,
          referenceSource: referenceSource || null,
          referenceScore,
          semanticReview: review,
          qualityWarning: splitPanelDetected
            ? "A possible center seam was detected; the generated image is returned for user review."
            : imageJob.referenceWarning
              ? "No verified reference image was available; VELA generated from identity traits instead."
            : null,
          generationAttempts: attempt,
          workflow: publicWorkflowSummary(spec)
        };
      }
      fallbackCandidates.push({
        result: payload.result,
        outputPath,
        review,
        attempt,
        score: Number(review?.score) || 0
      });
    }
    if (fallbackCandidates.length) {
      const [best, ...rejected] = fallbackCandidates.sort((left, right) => right.score - left.score);
      rejected.forEach((candidate) => quarantineRejectedImage(candidate.outputPath));
      const reasons = best.review?.issues?.length ? best.review.issues.join("；") : best.review?.summary;
      setImageJobPhase(imageJob, "finalizing-output");
      return {
        ...best.result,
        requestedEngine: spec.engine,
        referenceSource: referenceSource || null,
        referenceScore,
        semanticReview: best.review,
        qualityWarning: `Identity review was below the preferred threshold${reasons ? `: ${reasons}` : "."}`,
        generationAttempts: maxAttempts,
        workflow: publicWorkflowSummary(spec)
      };
    }
    const reasons = lastReview?.issues?.length ? lastReview.issues.join("；") : lastReview?.summary;
    throw new Error(`Generated image failed semantic quality review${reasons ? `: ${reasons}` : "."}`);
  } catch (error) {
    if (imageJob.cancelled) throw new Error("Image generation cancelled.");
    throw error;
  } finally {
    if (referenceDirectory) fs.rmSync(referenceDirectory, { recursive: true, force: true });
    if (activeImageJob === imageJob) activeImageJob = null;
  }
}

async function generateComfyImage(config, prompt, settings = {}, attachments = [], spec = null) {
  const imageJob = {
    promptId: "",
    phase: "preparing",
    startedAt: Date.now(),
    cancelled: false,
    baseUrl: ""
  };
  activeImageJob = imageJob;
  const profile = readComfyProfile(config);
  imageJob.baseUrl = profile.baseUrl;
  const engine = imageEngine(settings);
  const hasUserReference = attachments.some((item) => item?.type === "image" && item?.content);
  const hasKnownReference = Boolean(findKnownReference(prompt));
  const hasMemoryReference = Boolean(findCharacterMemory(prompt));
  const referenceWorkflowPath = engine === "flux2" ? profile.fluxReferenceWorkflowPath : profile.referenceWorkflowPath;
  const useReference = ["anime", "flux2"].includes(engine) && settings?.reference !== "off" && settings?.referenceSearch !== false && Boolean(
    hasUserReference
      || hasKnownReference
      || hasMemoryReference
      || spec?.needsReference
      || settings?.reference === "strict"
      || /(有兽焉|角色|人物|陌生角色|同人|ip-adapter|reference|character|角色设定|辟邪|bixie|pixiu|天禄|tianlu)/i.test(prompt)
  );
  let referenceContext;
  let uploadedReferenceName = "";
  let uploadedReferenceNames = [];
  try {
    throwIfImageCancelled(imageJob);
    if (useReference && fs.existsSync(referenceWorkflowPath)) {
      imageJob.phase = "reference";
      referenceContext = await createReferenceContext(profile, prompt, attachments, referenceWorkflowPath);
      uploadedReferenceName = referenceContext.uploadedName;
      uploadedReferenceNames = referenceContext.uploadedNames ?? [uploadedReferenceName].filter(Boolean);
    }
  } catch (error) {
    if (imageJob.cancelled) throw error;
    console.warn(`[VELA] Reference search unavailable; falling back to text-only generation: ${error instanceof Error ? error.message : String(error)}`);
  }
  const workflowPath = engine === "flux2"
    ? (referenceContext ? profile.fluxReferenceWorkflowPath : profile.fluxWorkflowPath)
    : referenceContext ? profile.referenceWorkflowPath : profile.workflowPath;
  if (!fs.existsSync(workflowPath)) {
    if (activeImageJob === imageJob) activeImageJob = null;
    throw new Error(`Image workflow is missing: ${workflowPath}`);
  }
  const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
  const promptNodeId = engine === "flux2" ? "4" : profile.promptNodeId;
  const promptInputName = engine === "flux2" ? "text" : profile.promptInputName;
  const node = workflow?.[promptNodeId];
  if (!node?.inputs) {
    if (activeImageJob === imageJob) activeImageJob = null;
    throw new Error(`ComfyUI prompt node ${profile.promptNodeId} is invalid.`);
  }
  imageJob.phase = "prompt";
  const preparedPrompt = await prepareImagePrompt(prompt, spec);
  throwIfImageCancelled(imageJob);
  const route = engine === "realistic" ? "realistic" : imageRoute(prompt, settings);
  node.inputs[promptInputName] = spec && engine !== "flux2"
    ? compileImagePrompt(spec, preparedPrompt, referenceContext?.visualSpec ?? "", Boolean(referenceContext))
    : engine === "flux2"
      ? routedFluxPrompt(preparedPrompt, referenceContext?.visualSpec ?? "", Boolean(referenceContext), prompt)
      : routedImagePrompt(preparedPrompt, route, referenceContext?.visualSpec ?? "", Boolean(referenceContext), prompt);
  const { width, height } = imageDimensions(settings);
  const steps = imageSteps(settings, engine);
  if (spec && workflow["7"]?.inputs) {
    workflow["7"].inputs.text = compileNegativePrompt(spec, settings);
  }
  if (engine === "flux2") {
    workflow["7"].inputs.steps = steps;
    workflow["7"].inputs.width = width;
    workflow["7"].inputs.height = height;
    workflow["9"].inputs.width = width;
    workflow["9"].inputs.height = height;
    workflow["8"].inputs.noise_seed = crypto.randomInt(1, 2147483647);
    workflow["12"].inputs.filename_prefix = "VELA-FLUX2";
    if (referenceContext && workflow["30"]?.inputs) {
      workflow["30"].inputs.image = uploadedReferenceName;
    }
  } else {
    if (workflow["3"]?.inputs) workflow["3"].inputs.steps = steps;
    if (workflow["3"]?.inputs) workflow["3"].inputs.seed = crypto.randomInt(1, 2147483647);
    if (workflow["5"]?.inputs) {
      workflow["5"].inputs.width = width;
      workflow["5"].inputs.height = height;
    }
  }
  const checkpointNode = workflow?.["4"];
  if (checkpointNode?.inputs) {
    checkpointNode.inputs.ckpt_name = engine === "ssd1b"
      ? "SSD-1B-A1111.safetensors"
      : route === "anime"
        ? "animagine-xl-4.0-opt.safetensors"
        : "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors";
  }
  if (referenceContext && workflow?.[profile.referenceImageNodeId]?.inputs) {
    if (uploadedReferenceNames.length > 1) {
      const regionalPrompts = Array.isArray(spec?.knownCharacters)
        ? spec.knownCharacters.slice(0, 2).map((character, index) => [
            index === 0 ? "left side" : "right side",
            character.prompt,
            "full body visible, standing naturally",
            "one continuous bamboo forest scene",
            "clean official-style anime linework"
          ].join(", "))
        : [];
      configureMultiReferenceIpAdapter(workflow, uploadedReferenceNames, {
        weight: 0.72,
        endAt: 0.82,
        width,
        height,
        regionalPrompts
      });
    } else {
      workflow[profile.referenceImageNodeId].inputs.image = uploadedReferenceName;
    }
    if (workflow["10"]?.inputs && uploadedReferenceNames.length === 1) {
      workflow["10"].inputs.weight = settings.reference === "strict" ? 1.0 : 0.86;
      workflow["10"].inputs.end_at = 1.0;
      workflow["10"].inputs.weight_type = "standard";
    }
  }
  try {
    throwIfImageCancelled(imageJob);
    const queued = await fetch(`${profile.baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: `vela-${crypto.randomUUID()}` })
    });
    if (!queued.ok) throw new Error(`ComfyUI queue failed (${queued.status}).`);
    const queuedPayload = await queued.json();
    const promptId = String(queuedPayload.prompt_id ?? "");
    if (!promptId) throw new Error("ComfyUI did not return a prompt id.");
    imageJob.promptId = promptId;
    imageJob.phase = "generating";
    throwIfImageCancelled(imageJob);

    const deadline = Date.now() + profile.timeoutMs;
    while (Date.now() < deadline) {
      throwIfImageCancelled(imageJob);
      const history = await fetch(`${profile.baseUrl}/history/${encodeURIComponent(promptId)}`);
      if (history.ok) {
        const record = (await history.json())?.[promptId];
        const outputNodeId = engine === "flux2" ? profile.fluxOutputNodeId : profile.outputNodeId;
        const images = record?.outputs?.[outputNodeId]?.images;
        if (Array.isArray(images) && images.length) {
          const upscaled = await upscaleGeneratedOutputs(profile, images, settings, route);
          if (referenceContext?.source === "user" && settings?.memory !== "once") {
            saveCharacterMemory(prompt, referenceContext.localPath);
          }
          return {
            promptId,
            engine,
            route,
            referenceUsed: Boolean(referenceContext),
            referenceSource: referenceContext?.source ?? "none",
            referenceCount: uploadedReferenceNames.length,
            width: upscaled.width,
            height: upscaled.height,
            resolution: upscaled.resolution,
            upscaled: upscaled.upscaled,
            outputs: upscaled.images.map((item) => {
              const localPath = comfyOutputPath(item);
              return {
                filename: String(item.filename),
                path: localPath,
                viewUrl: comfyViewUrl(profile, item)
              };
            })
          };
        }
          if (record?.status?.status_str === "error") {
            throw comfyExecutionError(record, "ComfyUI reported a generation error");
          }
      }
      await new Promise((resolve) => setTimeout(resolve, Math.max(250, profile.pollIntervalMs)));
    }
    throw new Error(`ComfyUI generation timed out after ${Math.round(profile.timeoutMs / 1000)} seconds.`);
  } finally {
    uploadedReferenceNames.forEach(removeUploadedReference);
    if (referenceContext?.tempDirectory) fs.rmSync(referenceContext.tempDirectory, { recursive: true, force: true });
    if (activeImageJob === imageJob) activeImageJob = null;
  }
}

async function generateVerifiedMultiCharacterImage(config, prompt, settings, attachments, spec) {
  const comfySettings = { ...settings, engine: "flux2", reference: "smart", quality: settings?.quality ?? "high" };
  if (!(await ensureComfyUi())) throw new Error("VELA high-fidelity reference backend could not start.");
  const result = await generateComfyImage(config, prompt, comfySettings, attachments, spec);
  const profile = readComfyProfile(config);
  try {
    await fetch(`${profile.baseUrl}/free`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unload_models: true, free_memory: true }),
      signal: AbortSignal.timeout(10000)
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));
  } catch {
    // Review still runs and will fail closed if memory is unavailable.
  }
  const outputPath = String(result?.outputs?.[0]?.path ?? "");
  const references = findKnownReferences(prompt).map((item) => item.path);
  let review;
  try {
    review = await evaluateGeneratedImage(outputPath, prompt, spec, references);
  } catch (error) {
    for (const output of result.outputs ?? []) quarantineRejectedImage(String(output?.path ?? ""));
    const concise = String(error instanceof Error ? error.message : error).split(/\r?\n/, 1)[0].slice(0, 240);
    throw new Error(`High-fidelity image review could not complete${concise ? `: ${concise}` : "."}`);
  }
  if (!review.available || Number(review.score) < 72) {
    const reasons = review?.issues?.length ? review.issues.join("；") : review?.summary;
    return {
      ...result,
      semanticReview: review,
      qualityWarning: `High-fidelity review was below the preferred threshold${reasons ? `: ${reasons}` : "."}`,
      generationAttempts: 1,
      workflow: publicWorkflowSummary(spec)
    };
  }
  return {
    ...result,
    semanticReview: review,
    generationAttempts: 1,
    workflow: publicWorkflowSummary(spec)
  };
}

async function generateWithAvailableImageBackend(prompt, settings, attachments, spec) {
  if (nativeImageEngineAvailable()) {
    return generateNativeImage(prompt, settings, attachments);
  }
  const bootstrapJob = {
    promptId: "",
    phase: "starting-compatible-engine",
    startedAt: Date.now(),
    cancelled: false,
    baseUrl: ""
  };
  activeImageJob = bootstrapJob;
  try {
    if (await ensureComfyUi()) {
      if (bootstrapJob.cancelled) throw new Error("Image generation cancelled.");
      if (activeImageJob === bootstrapJob) activeImageJob = null;
      return generateComfyImage({}, prompt, settings, attachments, spec);
    }
  } finally {
    if (activeImageJob === bootstrapJob) activeImageJob = null;
  }
  void installNativeImageRuntime();
  throw new Error("VELA 正在自动准备独立生图引擎。请在模型中心查看安装进度，准备完成后重试。");
}

function gatewayIsAvailable(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (available) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(available);
    };
    socket.setTimeout(800);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

function findComfyUi() {
  const portableRoot = "C:\\AI-Apps\\ComfyUI_windows_portable";
  const pythonPath = path.join(portableRoot, "python_embeded", "python.exe");
  const mainPath = path.join(portableRoot, "ComfyUI", "main.py");
  if (!fs.existsSync(pythonPath) || !fs.existsSync(mainPath)) return null;
  return { portableRoot, pythonPath, mainPath };
}

function startComfyUi() {
  const installation = findComfyUi();
  if (!installation) return false;
  const { pythonPath, mainPath } = installation;

  const outputDirectory = storagePaths().comfyOutputRoot;
  fs.mkdirSync(outputDirectory, { recursive: true });

  const child = spawn(
    pythonPath,
    [
      "-s",
      mainPath,
      "--windows-standalone-build",
      "--listen",
      APP_HOST,
      "--port",
      String(COMFY_PORT),
      "--output-directory",
      outputDirectory,
      "--lowvram",
      "--reserve-vram",
      "1",
      "--cpu-vae"
    ],
    {
      cwd: path.dirname(mainPath),
      detached: true,
      stdio: ["ignore", fs.openSync(path.join(outputDirectory, "..", "vela-comfyui.log"), "a"), fs.openSync(path.join(outputDirectory, "..", "vela-comfyui-error.log"), "a")],
      windowsHide: true
    }
  );
  child.unref();
  return true;
}

function startNativeImageEngine() {
  if (!nativeImageEngineAvailable()) return false;
  const storage = storagePaths();
  const logRoot = path.join(storage.comfyOutputRoot, "VELA-Native");
  fs.mkdirSync(logRoot, { recursive: true });
  const child = spawn(
    storage.nativePython,
    [nativeImageWorkerPath(), "--server", String(NATIVE_IMAGE_PORT)],
    {
      cwd: VELA_PROJECT_ROOT,
      windowsHide: true,
      env: {
        ...process.env,
        VELA_IMAGE_ENGINE_ROOT: storage.imageEngineRoot,
        VELA_MODEL_ROOT: storage.modelsRoot,
        VELA_IMAGE_OUTPUT_ROOT: storage.outputRoot,
        HF_HOME: path.join(storage.imageEngineRoot, "cache"),
        HF_HUB_CACHE: path.join(storage.imageEngineRoot, "cache", "hub"),
        TRANSFORMERS_CACHE: path.join(storage.imageEngineRoot, "cache", "transformers"),
        HF_HUB_DISABLE_SYMLINKS_WARNING: "1"
      },
      stdio: [
        "ignore",
        fs.openSync(path.join(logRoot, "native-engine.log"), "a"),
        fs.openSync(path.join(logRoot, "native-engine-error.log"), "a")
      ]
    }
  );
  nativeImageProcess = child;
  child.once("exit", () => {
    if (activeImageJob?.worker === child && !activeImageJob.cancelled) {
      activeImageJob.controller?.abort(new Error("VELA image worker exited before completing the request."));
    }
    if (nativeImageProcess === child) nativeImageProcess = null;
  });
  return true;
}

async function ensureNativeImageEngine() {
  if (await gatewayIsAvailable(NATIVE_IMAGE_PORT)) return true;
  if (nativeImageStartPromise) return nativeImageStartPromise;
  nativeImageStartPromise = (async () => {
    if (!startNativeImageEngine()) return false;
    for (let attempt = 0; attempt < 360; attempt += 1) {
      if (await gatewayIsAvailable(NATIVE_IMAGE_PORT)) return true;
      if (!nativeImageProcess) return false;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  })();
  try {
    return await nativeImageStartPromise;
  } finally {
    nativeImageStartPromise = null;
  }
}

async function releaseNativeImageEngineForReview(imageJob) {
  const child = nativeImageProcess;
  if (!child || child.killed) return;
  // The local vision reviewer also needs several GB of memory. Release SDXL
  // before review so a low-memory machine does not silently skip validation.
  if (imageJob?.worker === child) imageJob.worker = null;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
  if (nativeImageProcess === child) nativeImageProcess = null;
}

async function ensureComfyUi() {
  const isReady = async () => {
    try {
      const response = await fetch(`http://${APP_HOST}:${COMFY_PORT}/queue`, {
        signal: AbortSignal.timeout(1500)
      });
      return response.ok;
    } catch {
      return false;
    }
  };
  if (await isReady()) return true;
  if (comfyStartPromise) return comfyStartPromise;
  comfyStartPromise = (async () => {
    if (!startComfyUi()) return false;
    for (let attempt = 0; attempt < 360; attempt += 1) {
      if (await isReady()) return true;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  })();
  try {
    return await comfyStartPromise;
  } finally {
    comfyStartPromise = null;
  }
}

function secureHeaders(extra = {}) {
  return {
    "Cache-Control": "no-store",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    ...extra
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, secureHeaders({ "Content-Type": "application/json; charset=utf-8" }));
  res.end(JSON.stringify(payload));
}

function isInside(filePath, rootPath) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(filePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeStaticPath(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const candidate = path.resolve(root, decoded.replace(/^[/\\]+/, ""));
  return isInside(candidate, root) ? candidate : null;
}

function streamFile(req, res, filePath, cache = false) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }
  const stat = fs.statSync(filePath);
  const contentType = mimeTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.range;
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Number(match[2]) : stat.size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end >= stat.size) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      ...secureHeaders(),
      "Accept-Ranges": "bytes",
      "Cache-Control": cache ? "public, max-age=86400" : "no-store",
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Content-Type": contentType
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, {
    ...secureHeaders(),
    "Accept-Ranges": "bytes",
    "Cache-Control": cache ? "public, max-age=86400" : "no-store",
    "Content-Length": stat.size,
    "Content-Type": contentType
  });
  fs.createReadStream(filePath).pipe(res);
}

function requestIsAuthorized(req, url) {
  return req.headers["x-vela-app-key"] === appKey
    || req.headers["x-openclaw-app-key"] === appKey
    || url.searchParams.get("appKey") === appKey;
}

function requestComfyJson(requestPath, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      { host: APP_HOST, port: COMFY_PORT, path: requestPath, timeout: timeoutMs },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.once("timeout", () => request.destroy(new Error("ComfyUI status timed out")));
    request.once("error", reject);
  });
}

async function readOllamaHealth() {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", { signal: AbortSignal.timeout(1800) });
    if (!response.ok) return { state: "offline", count: 0 };
    const payload = await response.json();
    const models = Array.isArray(payload?.models) ? payload.models : [];
    return { state: "online", count: models.length };
  } catch {
    return { state: "offline", count: 0 };
  }
}

async function readInstalledOllamaModels() {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
    const payload = await response.json();
    return (Array.isArray(payload?.models) ? payload.models : []).map((item) => ({
      id: `ollama/${item.name}`,
      label: `本地 · ${item.name}`,
      provider: "ollama",
      installed: true,
      sizeBytes: Number(item.size || 0)
    }));
  } catch {
    return [];
  }
}

async function independentModelCatalog() {
  const config = readModelCenterConfig();
  const storage = storagePaths();
  const local = await readInstalledOllamaModels();
  const direct = discoverGgufModels([path.join(storage.modelsRoot, "GGUF")]).map((item) => ({
    ...item,
    id: `direct/${item.id}`,
    provider: "direct",
    installed: true,
    runtimeReady: Boolean(findLlamaServer(storage.directRuntimeRoot))
  }));
  const remote = config.providers.filter((item) => item.enabled).map((item) => ({
    id: `${item.id}/${item.model}`,
    label: `${item.label} · ${item.model}`,
    provider: item.id,
    installed: true,
    configured: true
  }));
  return {
    ...publicModelCenterConfig(config),
    directRuntime: {
      installed: Boolean(findLlamaServer(storage.directRuntimeRoot)),
      running: await gatewayIsAvailable(DIRECT_MODEL_PORT),
      root: storage.directRuntimeRoot
    },
    imageRuntime: {
      installed: nativeImageEngineAvailable(),
      root: storage.imageEngineRoot
    },
    storage,
    imageModels: imageModelCatalog(storage.modelsRoot),
    items: [...direct, ...local, ...remote]
  };
}

async function testProviderConnection(provider, apiKey) {
  const baseUrl = String(provider?.baseUrl || "").trim().replace(/\/$/, "");
  const model = String(provider?.model || "").trim();
  if (!/^https:\/\//i.test(baseUrl)) throw new Error("API 地址必须使用 HTTPS。");
  if (!model) throw new Error("模型名称不能为空。");
  if (!apiKey) throw new Error("请输入 API Key 后再验证。");
  const response = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 240).replace(/\s+/g, " ");
    throw new Error(`模型服务验证失败 (${response.status})${detail ? `：${detail}` : ""}`);
  }
  const payload = await response.json().catch(() => ({}));
  const available = Array.isArray(payload?.data)
    ? payload.data.map((item) => String(item?.id || item?.name || "")).filter(Boolean)
    : Array.isArray(payload?.models)
      ? payload.models.map((item) => String(item?.name || item?.id || "").replace(/^models\//, "")).filter(Boolean)
      : [];
  const exact = available.includes(model) || available.includes(`models/${model}`);
  return { ok: true, model, exact, availableCount: available.length };
}

async function installNativeImageRuntime() {
  const key = "runtime/image";
  if (modelDownloads.get(key)?.state === "downloading") return;
  modelDownloads.set(key, { model: key, state: "downloading", completed: 0, total: 0, status: "preparing" });
  try {
    const storage = storagePaths();
    const uv = await ensureManagedUv();
    if (!uv) throw new Error("VELA could not prepare its Python package manager.");
    const runtime = path.join(storage.imageEngineRoot, "runtime");
    const python = process.platform === "win32" ? path.join(runtime, "python.exe") : path.join(runtime, "bin", "python");
    if (!fs.existsSync(python)) await execFileAsync(uv, ["venv", "--python", "3.12", runtime], 600000);
    modelDownloads.set(key, { model: key, state: "downloading", completed: 0, total: 0, status: "installing-pytorch" });
    const torchArgs = ["pip", "install", "--python", python, "torch", "torchvision"];
    if (process.platform === "win32") torchArgs.push("--index-url", "https://download.pytorch.org/whl/cu128");
    await execFileAsync(uv, torchArgs, 1800000);
    modelDownloads.set(key, { model: key, state: "downloading", completed: 0, total: 0, status: "installing-image-packages" });
    await execFileAsync(uv, ["pip", "install", "--python", python, "--target", storage.nativePackages, "diffusers>=0.35", "transformers>=4.50", "accelerate", "safetensors", "pillow"], 1800000);
    if (!fs.existsSync(python) || !fs.existsSync(path.join(storage.nativePackages, "diffusers", "__init__.py"))) {
      throw new Error("Image runtime verification failed.");
    }
    modelDownloads.set(key, { model: key, state: "completed", completed: 1, total: 1 });
  } catch (error) {
    modelDownloads.set(key, { model: key, state: "failed", error: error instanceof Error ? error.message : String(error) });
  }
}

function execFileAsync(command, args, timeout) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(String(stderr || stdout || error.message).trim()));
        return;
      }
      resolve(stdout);
    });
  });
}

async function installImageModel(model) {
  const key = `image/${model}`;
  if (modelDownloads.get(key)?.state === "downloading") return;
  const assets = imageModelInstallAssets(model, storagePaths().modelsRoot);
  modelDownloads.set(key, { model: key, state: "downloading", completed: 0, total: 0 });
  try {
    for (const asset of assets) await downloadFile(asset.url, asset.path, key, asset.sha256);
    modelDownloads.set(key, { model: key, state: "completed", completed: 1, total: 1 });
  } catch (error) {
    if (modelDownloads.get(key)?.state !== "cancelled") {
      modelDownloads.set(key, { model: key, state: "failed", error: error instanceof Error ? error.message : String(error) });
    }
  }
}

async function downloadFile(url, destination, progressKey, expectedSha256 = "") {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await downloadFileOnce(url, destination, progressKey, expectedSha256);
    } catch (error) {
      lastError = error;
      if (modelDownloads.get(progressKey)?.state === "cancelled" || error?.name === "AbortError") throw error;
      modelDownloads.set(progressKey, {
        ...modelDownloads.get(progressKey), model: progressKey, state: "downloading",
        status: `retrying-${attempt}`, error: error instanceof Error ? error.message : String(error)
      });
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw lastError;
}

async function downloadFileOnce(url, destination, progressKey, expectedSha256 = "") {
  const partial = `${destination}.part`;
  const offset = fs.existsSync(partial) ? fs.statSync(partial).size : 0;
  const controller = new AbortController();
  modelDownloadControllers.set(progressKey, controller);
  const response = await fetch(url, {
    redirect: "follow",
    headers: offset > 0 ? { Range: `bytes=${offset}-` } : {},
    signal: controller.signal
  });
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}).`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const resumed = offset > 0 && response.status === 206;
  const initial = resumed ? offset : 0;
  const total = initial + Number(response.headers.get("content-length") || 0);
  const disk = fs.statfsSync(path.dirname(destination));
  const available = Number(disk.bavail) * Number(disk.bsize);
  if (total > 0 && total - initial > available) throw new Error("Not enough free space on the selected model drive.");
  let completed = initial;
  const output = fs.createWriteStream(partial, { flags: resumed ? "a" : "w" });
  try {
    for await (const chunk of response.body) {
      completed += chunk.length;
      output.write(chunk);
      modelDownloads.set(progressKey, { model: progressKey, state: "downloading", completed, total });
    }
  } finally {
    await new Promise((resolve) => output.end(resolve));
    modelDownloadControllers.delete(progressKey);
  }
  if (expectedSha256) {
    const digest = await sha256File(partial);
    if (digest !== expectedSha256.toLowerCase()) {
      fs.rmSync(partial, { force: true });
      throw new Error("Downloaded model failed SHA-256 verification; the corrupted partial file was removed.");
    }
  }
  fs.rmSync(destination, { force: true });
  fs.renameSync(partial, destination);
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const input = fs.createReadStream(filePath);
    input.on("error", reject);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("end", () => resolve(hash.digest("hex")));
  });
}

function cancelModelDownload(key) {
  const controller = modelDownloadControllers.get(key);
  if (!controller) return false;
  controller.abort(new Error("Download cancelled by user."));
  modelDownloads.set(key, { ...modelDownloads.get(key), model: key, state: "cancelled" });
  return true;
}

async function installDirectRuntime() {
  const directRuntimeRoot = storagePaths().directRuntimeRoot;
  const key = "llama.cpp";
  if (modelDownloads.get(key)?.state === "downloading") return;
  modelDownloads.set(key, { model: key, state: "downloading", completed: 0, total: 0 });
  const archive = path.join(directRuntimeRoot, process.platform === "win32" ? "llama.cpp-runtime.zip" : "llama.cpp-runtime.tar.gz");
  try {
    const releaseResponse = await fetch("https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=20", {
      headers: { "User-Agent": "VELA-Desktop" }, signal: AbortSignal.timeout(15000)
    });
    if (!releaseResponse.ok) throw new Error(`GitHub release lookup failed (${releaseResponse.status}).`);
    const releases = await releaseResponse.json();
    const assetPattern = process.platform === "win32"
      ? /^llama-.*-bin-win-vulkan-x64\.zip$/i
      : process.platform === "darwin" && process.arch === "arm64"
        ? /^llama-.*-bin-macos-arm64\.tar\.gz$/i
        : process.platform === "darwin"
          ? /^llama-.*-bin-macos-x64\.tar\.gz$/i
          : null;
    if (!assetPattern) throw new Error(`Direct local runtime is not available for ${process.platform}/${process.arch}.`);
    const asset = (Array.isArray(releases) ? releases : [])
      .flatMap((release) => release.assets || [])
      .find((item) => assetPattern.test(item.name));
    if (!asset?.browser_download_url) throw new Error(`No current llama.cpp package was found for ${process.platform}/${process.arch}.`);
    await downloadFile(asset.browser_download_url, archive, key);
    if (process.platform === "win32") {
      await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Expand-Archive -LiteralPath '${archive.replaceAll("'", "''")}' -DestinationPath '${directRuntimeRoot.replaceAll("'", "''")}' -Force`], 600000);
    } else {
      await execFileAsync("tar", ["-xzf", archive, "-C", directRuntimeRoot], 600000);
    }
    const serverPath = findLlamaServer(directRuntimeRoot);
    if (!serverPath) throw new Error("llama-server was not found after extraction.");
    if (process.platform !== "win32") fs.chmodSync(serverPath, 0o755);
    modelDownloads.set(key, { model: key, state: "completed", completed: 1, total: 1 });
  } catch (error) {
    if (modelDownloads.get(key)?.state !== "cancelled") {
      modelDownloads.set(key, { model: key, state: "failed", error: error instanceof Error ? error.message : String(error) });
    }
  } finally {
    fs.rmSync(archive, { force: true });
  }
}

async function installDirectModel(model) {
  const catalog = {
    "qwen3-4b-q4": {
      fileName: "Qwen3-4B-Q4_K_M.gguf",
      url: "https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf?download=true",
      sha256: "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
    }
  };
  const entry = catalog[model];
  if (!entry) throw new Error("Unknown direct model.");
  if (modelDownloads.get(model)?.state === "downloading") return;
  const destination = path.join(storagePaths().modelsRoot, "GGUF", entry.fileName);
  modelDownloads.set(model, { model, state: "downloading", completed: 0, total: 0 });
  try {
    await downloadFile(entry.url, destination, model, entry.sha256);
    const id = directModelId(destination);
    const config = readModelCenterConfig();
    config.directModels = config.directModels.filter((item) => item.id !== id);
    config.directModels.push({ id, label: "Qwen3 4B Q4", modelPath: destination, contextSize: 4096, gpuLayers: 99 });
    config.primary = `direct/${id}`;
    saveModelCenterConfig(modelCenterConfigPath(), config);
    modelDownloads.set(model, { model, state: "completed", completed: 1, total: 1, destination });
    void restartOcuApi();
  } catch (error) {
    if (modelDownloads.get(model)?.state !== "cancelled") {
      modelDownloads.set(model, { model, state: "failed", error: error instanceof Error ? error.message : String(error) });
    }
  }
}

async function installDirectStarter(model) {
  await installDirectRuntime();
  const runtime = modelDownloads.get("llama.cpp");
  if (runtime?.state !== "completed" && !findLlamaServer(storagePaths().directRuntimeRoot)) {
    throw new Error(runtime?.error || "Direct model runtime installation failed.");
  }
  await installDirectModel(model);
}

async function installOllamaModel(model) {
  if (!/^[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)?$/.test(model)) {
    throw new Error("Invalid Ollama model name.");
  }
  if (modelDownloads.get(model)?.state === "downloading") return;
  modelDownloads.set(model, { model, state: "downloading", completed: 0, total: 0 });
  try {
    const response = await fetch("http://127.0.0.1:11434/api/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true })
    });
    if (!response.ok || !response.body) throw new Error(`Ollama pull failed (${response.status}).`);
    const decoder = new TextDecoder();
    let buffered = "";
    for await (const chunk of response.body) {
      buffered += decoder.decode(chunk, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const update = JSON.parse(line);
        modelDownloads.set(model, {
          model,
          state: update.status === "success" ? "completed" : "downloading",
          status: String(update.status || ""),
          completed: Number(update.completed || 0),
          total: Number(update.total || 0)
        });
      }
    }
    modelDownloads.set(model, { ...modelDownloads.get(model), model, state: "completed" });
    const catalogEntry = RECOMMENDED_LOCAL_MODELS.find((item) => item.id === model);
    if (catalogEntry?.category !== "embedding") {
      const config = readModelCenterConfig();
      config.primary = `ollama/${model}`;
      saveModelCenterConfig(modelCenterConfigPath(), config);
      void restartOcuApi();
    }
  } catch (error) {
    modelDownloads.set(model, {
      model,
      state: "failed",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function resourceSnapshot() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const storage = storagePaths();
  const snapshot = {
    memoryTotalGb: Number((totalBytes / 1024 ** 3).toFixed(1)),
    memoryFreeGb: Number((freeBytes / 1024 ** 3).toFixed(1)),
    memoryPressure: freeBytes / totalBytes < 0.15,
    modelLibrary: storage.modelsRoot,
    modelLibraryFreeGb: null
  };
  try {
    const stats = fs.statfsSync(storage.modelsRoot);
    snapshot.modelLibraryFreeGb = Number(((Number(stats.bavail) * Number(stats.bsize)) / 1024 ** 3).toFixed(1));
  } catch {
    // Disk free space is optional on older Electron runtimes.
  }
  return snapshot;
}

async function detectSystemProfile() {
  const storage = storagePaths();
  let freeDiskBytes = null;
  try {
    const stats = fs.statfsSync(storage.modelsRoot);
    freeDiskBytes = Number(stats.bavail) * Number(stats.bsize);
  } catch {
    // The profile remains useful when the filesystem cannot report capacity.
  }
  const gpus = await detectGpus();
  const online = await networkIsAvailable();
  return buildSystemProfile({
    platform: process.platform,
    arch: process.arch,
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    freeDiskBytes,
    gpus,
    online
  });
}

async function detectGpus() {
  try {
    if (process.platform === "win32") {
      try {
        const nvidiaOutput = await execFileAsync("nvidia-smi.exe", ["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"], 5000);
        const nvidiaGpus = nvidiaOutput.split(/\r?\n/).filter(Boolean).map((line) => {
          const comma = line.lastIndexOf(",");
          return { name: line.slice(0, comma).trim(), vendor: "nvidia", memoryGb: Number(line.slice(comma + 1).trim()) / 1024 };
        }).filter((gpu) => gpu.name && Number.isFinite(gpu.memoryGb));
        if (nvidiaGpus.length) return nvidiaGpus;
      } catch {
        // Fall back to Windows inventory when the NVIDIA utility is absent.
      }
      const stdout = await execFileAsync("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-Command",
        "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress"
      ], 8000);
      const parsed = JSON.parse(stdout || "[]");
      return (Array.isArray(parsed) ? parsed : [parsed]).filter(Boolean).map((gpu) => ({
        name: String(gpu.Name || "Unknown GPU"),
        memoryGb: Number(gpu.AdapterRAM || 0) / 1024 ** 3
      }));
    }
    if (process.platform === "darwin") {
      const stdout = await execFileAsync("system_profiler", ["SPDisplaysDataType", "-json"], 10000);
      const payload = JSON.parse(stdout || "{}");
      return (payload.SPDisplaysDataType || []).map((gpu) => ({
        name: String(gpu.sppci_model || gpu._name || "Apple GPU"),
        vendor: String(gpu.spdisplays_vendor || "apple").includes("Apple") ? "apple" : "unknown",
        memoryGb: parseGpuMemory(gpu.spdisplays_vram || gpu.spdisplays_vram_shared)
      }));
    }
  } catch {
    // Hardware detection is best effort and must not block first launch.
  }
  return [];
}

function parseGpuMemory(value) {
  const match = String(value || "").match(/([\d.]+)\s*(GB|MB)/i);
  if (!match) return null;
  const amount = Number(match[1]);
  return match[2].toUpperCase() === "MB" ? amount / 1024 : amount;
}

async function networkIsAvailable() {
  try {
    const response = await fetch("https://github.com/", { method: "HEAD", signal: AbortSignal.timeout(3500) });
    return response.ok;
  } catch {
    return false;
  }
}

function diagnosticsRoot() {
  const root = path.join(app.getPath("userData"), "diagnostics");
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function writeDiagnostic(kind, details = {}) {
  const record = {
    kind,
    release: VELA_RELEASE,
    platform: process.platform,
    arch: process.arch,
    timestamp: new Date().toISOString(),
    details: redactDiagnosticValue(details)
  };
  const filePath = path.join(diagnosticsRoot(), `${Date.now()}-${String(kind).replace(/[^a-z0-9_-]/gi, "-")}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return filePath;
}

function redactDiagnosticValue(value) {
  if (Array.isArray(value)) return value.map(redactDiagnosticValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /(api[_-]?key|token|authorization|password|secret)/i.test(key) ? "[REDACTED]" : redactDiagnosticValue(item)
  ]));
}

async function exportUserData() {
  const selected = await dialog.showOpenDialog({
    title: "选择 VELA 数据导出目录",
    properties: ["openDirectory", "createDirectory"]
  });
  if (selected.canceled || !selected.filePaths[0]) return { canceled: true };
  const destination = path.join(selected.filePaths[0], `VELA-Export-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.mkdirSync(destination, { recursive: true });
  const sources = [
    "sessions.db", "memory.db", "plans.db", "governance.db", "models.json", "storage.json"
  ];
  const exported = [];
  for (const name of sources) {
    const source = path.join(app.getPath("userData"), name);
    if (!fs.existsSync(source)) continue;
    fs.copyFileSync(source, path.join(destination, name));
    exported.push(name);
  }
  const manifest = {
    format: "VELA user data export",
    release: VELA_RELEASE,
    createdAt: new Date().toISOString(),
    files: exported,
    excludes: ["API keys", "model files", "temporary cache"]
  };
  fs.writeFileSync(path.join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { canceled: false, destination, files: exported };
}

function createServer() {
  const storage = storagePaths();
  const allowedMediaExtensions = new Set([
    ".bmp", ".gif", ".jpeg", ".jpg", ".mp3", ".mp4", ".pdf", ".png", ".wav", ".webm", ".webp"
  ]);
  const allowedMediaRoots = [
    app.getPath("userData"),
    path.join(VELA_PROJECT_ROOT, ".vela"),
    path.join(VELA_PROJECT_ROOT, ".openclaw"),
    storage.dataRoot,
    storage.modelsRoot,
    storage.outputRoot,
    storage.imageEngineRoot
  ].filter((candidate) => fs.existsSync(candidate));

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${APP_HOST}:${APP_PORT}`);
      if (url.pathname === "/api/bootstrap") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        sendJson(res, 200, {
          apiMode: "vela-independent",
          apiBaseUrl: `http://${APP_HOST}:${OCU_PORT}`,
          version: app.getVersion(),
          release: VELA_RELEASE
        });
        return;
      }

      if (url.pathname === "/api/system-profile" && req.method === "GET") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        sendJson(res, 200, await detectSystemProfile());
        return;
      }

      if (url.pathname === "/api/privacy" && req.method === "GET") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        sendJson(res, 200, {
          localFirst: true,
          telemetry: false,
          diagnosticsUpload: false,
          apiKeys: safeStorage.isEncryptionAvailable() ? "encrypted-on-device" : "not-stored",
          externalRequests: ["model downloads you start", "API providers you configure", "reference search for identity-sensitive image generation"],
          dataRoot: storagePaths().dataRoot
        });
        return;
      }

      if (url.pathname === "/api/diagnostics" && req.method === "GET") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const files = fs.readdirSync(diagnosticsRoot()).filter((name) => name.endsWith(".json")).sort().reverse().slice(0, 25);
        sendJson(res, 200, { root: diagnosticsRoot(), files });
        return;
      }

      if (url.pathname === "/api/data/export" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        sendJson(res, 200, await exportUserData());
        return;
      }

      if (url.pathname === "/api/storage/open" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        await shell.openPath(storagePaths().dataRoot);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/support/feedback" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        await shell.openExternal("https://github.com/FlightCatcher/VELA/issues/new/choose");
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/health" && req.method === "GET") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const [ollama, ocu] = await Promise.all([
          readOllamaHealth(),
          gatewayIsAvailable(OCU_PORT)
        ]);
        const nativeImage = nativeImageEngineAvailable();
        const compatibleImage = Boolean(findComfyUi());
        const imageReady = nativeImage || compatibleImage;
        sendJson(res, 200, {
          ok: ocu && imageReady,
          release: VELA_RELEASE,
          services: {
            agent: { state: ocu ? "online" : "offline", port: OCU_PORT, backend: "vela" },
            comfy: {
              state: imageReady ? "online" : "offline",
              port: nativeImage ? null : COMFY_PORT,
              backend: nativeImage ? "vela-native" : compatibleImage ? "compatible-local" : "unavailable"
            },
            ollama: { state: ollama.state, models: ollama.count, port: 11434 },
            ocu: { state: ocu ? "online" : "offline", port: OCU_PORT }
          },
          resources: resourceSnapshot(),
          learning: {
            mode: "controlled-local",
            characterMemories: readCharacterMemory().length,
            autonomousTraining: false
          },
          imageJob: activeImageJob
            ? { phase: activeImageJob.phase, promptId: activeImageJob.promptId, cancellable: true }
            : null
        });
        return;
      }

      if (url.pathname === "/api/models") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        sendJson(res, 200, await independentModelCatalog());
        return;
      }

      if (url.pathname === "/api/permissions" && req.method === "GET") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        sendJson(res, 200, publicPermissionConfig(loadPermissionConfig(permissionConfigPath())));
        return;
      }

      if (url.pathname === "/api/permissions" && req.method === "PUT") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        try {
          const payload = JSON.parse(await readRequestBody(req));
          const config = savePermissionConfig(
            permissionConfigPath(),
            { profile: payload?.profile },
            String(payload?.confirmation || "")
          );
          const restarted = await restartOcuApi();
          sendJson(res, 200, { ok: true, restarted, ...publicPermissionConfig(config) });
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
        }
        return;
      }

      if (url.pathname === "/api/plugins" && req.method === "GET") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        sendJson(res, 200, publicPluginCatalog(loadPluginConfig(pluginConfigPath())));
        return;
      }

      if (url.pathname === "/api/plugins/install" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        try {
          const payload = JSON.parse(await readRequestBody(req));
          const permissions = loadPermissionConfig(permissionConfigPath());
          const catalog = installPlugin(pluginConfigPath(), String(payload?.plugin || ""), permissions.profile);
          await restartOcuApi();
          sendJson(res, 200, { ok: true, ...catalog });
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
        }
        return;
      }

      if (url.pathname.startsWith("/api/plugins/") && req.method === "DELETE") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const pluginId = decodeURIComponent(url.pathname.slice("/api/plugins/".length));
        const catalog = uninstallPlugin(pluginConfigPath(), pluginId);
        await restartOcuApi();
        sendJson(res, 200, { ok: true, ...catalog });
        return;
      }

      if (url.pathname === "/api/storage" && req.method === "GET") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        sendJson(res, 200, storagePaths());
        return;
      }

      if (url.pathname === "/api/storage/select" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const selected = await dialog.showOpenDialog({
          title: "选择 VELA 数据与模型目录",
          defaultPath: storagePaths().dataRoot,
          properties: ["openDirectory", "createDirectory"]
        });
        if (selected.canceled || !selected.filePaths[0]) {
          sendJson(res, 200, { ok: false, canceled: true, storage: storagePaths() });
          return;
        }
        const storage = saveStorageConfig(storageConfigPath(), { dataRoot: selected.filePaths[0] });
        ensureStorageDirectories(storage);
        sendJson(res, 200, { ok: true, restartRequired: true, storage });
        return;
      }

      if (url.pathname === "/api/update" && req.method === "GET") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        sendJson(res, 200, updateState);
        return;
      }

      if (url.pathname === "/api/update/check" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        if (!app.isPackaged) {
          sendJson(res, 200, { state: "development", version: VELA_RELEASE });
          return;
        }
        void autoUpdater.checkForUpdates();
        sendJson(res, 202, { state: "checking" });
        return;
      }

      if (url.pathname === "/api/update/download" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        void autoUpdater.downloadUpdate();
        sendJson(res, 202, { state: "downloading" });
        return;
      }

      if (url.pathname === "/api/models/install" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const payload = JSON.parse(await readRequestBody(req));
        const model = String(payload?.model || "").trim();
        if (!RECOMMENDED_LOCAL_MODELS.some((item) => item.id === model)) {
          sendJson(res, 400, { error: "Unknown model catalog entry." });
          return;
        }
        void installOllamaModel(model);
        sendJson(res, 202, { ok: true, model, state: "downloading" });
        return;
      }

      if (url.pathname === "/api/models/downloads" && req.method === "GET") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        sendJson(res, 200, { downloads: [...modelDownloads.values()] });
        return;
      }

      if (url.pathname.startsWith("/api/models/downloads/") && req.method === "DELETE") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const key = decodeURIComponent(url.pathname.slice("/api/models/downloads/".length));
        sendJson(res, 200, { ok: cancelModelDownload(key), model: key });
        return;
      }

      if (url.pathname === "/api/image-models/install" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const payload = JSON.parse(await readRequestBody(req));
        const model = String(payload?.model || "").trim();
        try {
          imageModelInstallAssets(model, storagePaths().modelsRoot);
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
          return;
        }
        void installImageModel(model);
        sendJson(res, 202, { ok: true, model, state: "downloading" });
        return;
      }

      if (url.pathname === "/api/image-runtime/install" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        void installNativeImageRuntime();
        sendJson(res, 202, { ok: true, state: "downloading", target: storagePaths().imageEngineRoot });
        return;
      }

      if (url.pathname === "/api/direct-runtime/install" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        void installDirectRuntime();
        sendJson(res, 202, { ok: true, state: "downloading", target: storagePaths().directRuntimeRoot });
        return;
      }

      if (url.pathname === "/api/direct-models/install" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const payload = JSON.parse(await readRequestBody(req));
        const model = String(payload?.model || "").trim();
        if (model !== "qwen3-4b-q4") {
          sendJson(res, 400, { error: "Unknown direct model." });
          return;
        }
        void installDirectStarter(model).catch((error) => {
          modelDownloads.set(model, { model, state: "failed", error: error instanceof Error ? error.message : String(error) });
        });
        sendJson(res, 202, { ok: true, model, state: "downloading", target: path.join(storagePaths().modelsRoot, "GGUF") });
        return;
      }

      if (url.pathname === "/api/providers/test" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        try {
          const payload = JSON.parse(await readRequestBody(req));
          const config = readModelCenterConfig();
          const encrypted = config.providers.find((item) => item.id === payload.id)?.encryptedApiKey || "";
          const apiKey = String(payload.apiKey || (encrypted ? decryptApiKey(encrypted) : ""));
          sendJson(res, 200, await testProviderConnection(payload, apiKey));
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
        }
        return;
      }

      if (url.pathname === "/api/providers" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const payload = JSON.parse(await readRequestBody(req));
        const config = readModelCenterConfig();
        const provider = {
          id: String(payload.id || "").trim(),
          label: String(payload.label || payload.id || "").trim(),
          baseUrl: String(payload.baseUrl || "").trim(),
          model: String(payload.model || "").trim(),
          encryptedApiKey: payload.apiKey
            ? encryptApiKey(String(payload.apiKey))
            : config.providers.find((item) => item.id === payload.id)?.encryptedApiKey || "",
          enabled: payload.enabled !== false
        };
        if (!/^[a-z0-9_-]+$/i.test(provider.id) || !/^https:\/\//i.test(provider.baseUrl) || !provider.model) {
          sendJson(res, 400, { error: "Invalid provider configuration." });
          return;
        }
        config.providers = [...config.providers.filter((item) => item.id !== provider.id), provider];
        if (payload.activate !== false) config.primary = `${provider.id}/${provider.model}`;
        const saved = saveModelCenterConfig(modelCenterConfigPath(), config);
        sendJson(res, 200, publicModelCenterConfig(saved));
        void restartOcuApi();
        return;
      }

      if (url.pathname === "/api/generate-image" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const payload = JSON.parse(await readRequestBody(req));
        const prompt = typeof payload?.prompt === "string" ? payload.prompt.trim() : "";
        if (!prompt) {
          sendJson(res, 400, { error: "Image prompt is empty." });
          return;
        }
        if (activeImageJob && imageJobIsStale(activeImageJob)) {
          const staleJob = activeImageJob;
          await interruptActiveImageJob();
          if (activeImageJob === staleJob) activeImageJob = null;
          console.warn(`[VELA] Recovered stale image job (${staleJob.phase || "unknown"}).`);
        }
        if (activeImageJob) {
          sendJson(res, 409, {
            error: `Another image is still ${activeImageJob.phase || "running"}. Wait for it to finish or stop it before starting a new one.`
          });
          return;
        }
        const settings = payload?.settings && typeof payload.settings === "object" ? payload.settings : {};
        const attachments = Array.isArray(payload?.attachments) ? payload.attachments.slice(0, 2) : [];
        // BITS is already a low-priority background transfer. Suspending it from the
        // request path can block indefinitely on some Windows installations and leave
        // the renderer showing a preparation card while no image worker is running.
        const spec = analyzeImageRequest(prompt, settings, attachments);
        sendJson(res, 200, await generateWithAvailableImageBackend(prompt, settings, attachments, spec));
        return;
      }

      if (url.pathname === "/api/image-cancel" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        sendJson(res, 200, { ok: await interruptActiveImageJob() });
        return;
      }

      if (url.pathname === "/api/model" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const payload = JSON.parse(await readRequestBody(req));
        const model = typeof payload?.model === "string" ? payload.model.trim() : "";
        const catalog = await independentModelCatalog();
        const selected = catalog.items.find((item) => item.id === model);
        if (!selected) {
          sendJson(res, 400, { error: "Model is not configured for VELA." });
          return;
        }
        const config = readModelCenterConfig();
        if (selected.provider === "direct") {
          const directId = selected.id.slice("direct/".length);
          const directModel = {
            id: directId,
            label: selected.label,
            modelPath: selected.modelPath,
            contextSize: selected.contextSize,
            gpuLayers: selected.gpuLayers
          };
          config.directModels = [
            ...config.directModels.filter((item) => item.id !== directId),
            directModel
          ];
          if (!await ensureDirectModelRuntime(directModel)) {
            sendJson(res, 503, { error: "Direct runtime is unavailable. Install llama.cpp from Model Center first." });
            return;
          }
        } else {
          await stopDirectModelRuntime();
        }
        config.primary = selected.id;
        saveModelCenterConfig(modelCenterConfigPath(), config);
        await restartOcuApi();
        sendJson(res, 200, { primary: selected.id, label: selected.label });
        return;
      }

      if (url.pathname === "/api/chat" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const payload = JSON.parse(await readRequestBody(req));
        try {
          sendJson(res, 200, (await requestOcuJson("/v1/chat", "POST", payload, 900000)).data);
        } catch (error) {
          if (!isMissingSessionError(error)) throw error;
          const created = (await requestOcuJson("/v1/sessions", "POST", { title: "Recovered conversation" }, 10000)).data;
          const recoveredPayload = { ...payload, session_id: created.id };
          const recovered = (await requestOcuJson("/v1/chat", "POST", recoveredPayload, 900000)).data;
          sendJson(res, 200, { ...recovered, recovered_session: true });
        }
        return;
      }

      if (url.pathname === "/api/sessions" && req.method === "GET") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        sendJson(res, 200, (await requestOcuJson("/v1/sessions", "GET", null, 10000)).data);
        return;
      }

      if (url.pathname === "/api/sessions" && req.method === "POST") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const payload = JSON.parse(await readRequestBody(req));
        sendJson(res, 200, (await requestOcuJson("/v1/sessions", "POST", payload, 10000)).data);
        return;
      }

      const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/(messages|delete)$/);
      if (sessionMatch) {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const [, sessionId, operation] = sessionMatch;
        const method = operation === "delete" ? "DELETE" : "GET";
        const target = `/v1/sessions/${encodeURIComponent(sessionId)}/${operation}`;
        sendJson(res, 200, (await requestOcuJson(target, method, null, 10000)).data);
        return;
      }

      if (url.pathname === "/api/image-status") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const nativeImage = nativeImageEngineAvailable();
        const compatibleImage = Boolean(findComfyUi());
        sendJson(res, 200, {
          online: nativeImage || compatibleImage,
          running: activeImageJob ? 1 : 0,
          pending: 0,
          runningPromptId: activeImageJob?.promptId ?? "",
          pendingPromptId: "",
          activePhase: activeImageJob?.phase ?? "",
          startedAt: activeImageJob?.startedAt ?? null,
          phaseStartedAt: activeImageJob?.phaseStartedAt ?? activeImageJob?.startedAt ?? null,
          phaseElapsedMs: activeImageJob ? Math.max(0, Date.now() - (activeImageJob.phaseStartedAt ?? activeImageJob.startedAt ?? Date.now())) : 0,
          workflow: activeImageJob?.workflow ?? null,
          compiled: activeImageJob?.compiled ?? null,
          cancellable: Boolean(activeImageJob),
          backend: nativeImage ? "vela-native" : compatibleImage ? "compatible-local" : "unavailable"
        });
        return;
      }

      if (url.pathname === "/api/ocu/status" && req.method === "GET") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const [agentOnline, ollama] = await Promise.all([
          gatewayIsAvailable(OCU_PORT),
          readOllamaHealth()
        ]);
        const directOnline = await gatewayIsAvailable(DIRECT_MODEL_PORT);
        const imageOnline = nativeImageEngineAvailable();
        const components = [
          { name: "Agent Runtime", state: agentOnline ? "online" : "offline", detail: `127.0.0.1:${OCU_PORT}` },
          { name: "Direct GGUF", state: directOnline ? "online" : findLlamaServer(storagePaths().directRuntimeRoot) ? "ready" : "offline", detail: directOnline ? "llama.cpp model loaded" : "llama.cpp local runtime" },
          { name: "Ollama", state: ollama.state, detail: `${ollama.count} installed models` },
          { name: "Image Engine", state: imageOnline ? "ready" : "offline", detail: "VELA native image pipeline" }
        ];
        sendJson(res, 200, {
          ok: true,
          data: {
            state: agentOnline ? "online" : "starting",
            components
          }
        });
        return;
      }

      if (url.pathname === "/api/ocu/plans" && req.method === "GET") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        try {
          await ensureOcuApi();
          sendJson(res, 200, await requestOcuJson("/v1/plans"));
        } catch (error) {
          sendJson(res, 503, {
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        return;
      }

      const ocuPlanRoute = url.pathname.match(/^\/api\/ocu\/plans\/([^/]+)(?:\/(show|reflect|run))?$/);
      if (ocuPlanRoute && (req.method === "GET" || req.method === "POST")) {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const planId = decodeURIComponent(ocuPlanRoute[1]);
        const operation = ocuPlanRoute[2] ?? "show";
        const apiPath = operation === "show"
          ? `/v1/plans/${encodeURIComponent(planId)}`
          : `/v1/plans/${encodeURIComponent(planId)}/${operation}`;
        try {
          await ensureOcuApi();
          sendJson(res, 200, await requestOcuJson(apiPath, operation === "show" ? "GET" : "POST"));
        } catch (error) {
          sendJson(res, 503, {
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        return;
      }

      if (url.pathname === "/media") {
        if (!requestIsAuthorized(req, url)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        const rawPath = url.searchParams.get("path") ?? "";
        const resolved = path.resolve(rawPath);
        const extension = path.extname(resolved).toLowerCase();
        if (
          !path.isAbsolute(rawPath) ||
          !allowedMediaExtensions.has(extension) ||
          !allowedMediaRoots.some((root) => isInside(resolved, root))
        ) {
          sendJson(res, 403, { error: "Media path is not allowed" });
          return;
        }
        streamFile(req, res, resolved);
        return;
      }

      if (url.pathname === "/deps/marked.js") {
        streamFile(req, res, path.join(appRoot, "node_modules", "marked", "lib", "marked.esm.js"), true);
        return;
      }
      if (url.pathname === "/deps/purify.js") {
        streamFile(req, res, path.join(appRoot, "node_modules", "dompurify", "dist", "purify.es.mjs"), true);
        return;
      }

      const requestPath = url.pathname === "/" ? "index.html" : url.pathname;
      const staticPath = safeStaticPath(rendererRoot, requestPath);
      if (!staticPath) {
        sendJson(res, 403, { error: "Forbidden" });
        return;
      }
      if (path.extname(staticPath).toLowerCase() === ".html") {
        res.setHeader(
          "Content-Security-Policy",
          [
            "default-src 'self'",
            "connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*",
            "img-src 'self' data: blob: https: http:",
            "media-src 'self' data: blob: https: http:",
            "style-src 'self' 'unsafe-inline'",
            "script-src 'self'"
          ].join("; ")
        );
      }
      // Renderer modules define request routing and must never survive an app
      // upgrade in Chromium's disk cache. A stale intents.js caused explicit
      // image requests to be sent to the chat agent after the fix was already
      // packaged. Vendor dependencies remain cacheable above.
      streamFile(req, res, staticPath, false);
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 980,
    minHeight: 650,
    show: false,
    backgroundColor: "#f4f4f2",
    icon: path.join(appRoot, "build", "vela-icon.ico"),
    title: "VELA",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#00000000",
      symbolColor: "#737373",
      height: 42
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const localOrigin = `http://${APP_HOST}:${APP_PORT}`;
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(localOrigin)) {
      return { action: "allow" };
    }
    void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(localOrigin)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
  const revealWindow = () => {
    if (!window.isDestroyed() && !window.isVisible()) window.show();
  };
  const revealTimer = setTimeout(revealWindow, 3000);
  revealTimer.unref?.();
  window.once("ready-to-show", () => {
    clearTimeout(revealTimer);
    revealWindow();
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error(`VELA renderer failed to load (${errorCode}): ${errorDescription}`);
    revealWindow();
  });
  void window.loadURL(`${localOrigin}/?appKey=${appKey}`);
  return window;
}

let server;
let ocuProcess = null;
let ocuStartPromise = null;
let comfyStartPromise = null;
let nativeImageProcess = null;
let nativeImageStartPromise = null;
let directModelProcess = null;
let directModelPath = "";

async function stopDirectModelRuntime() {
  if (!directModelProcess || directModelProcess.exitCode !== null) return;
  const child = directModelProcess;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 4000))]);
  if (directModelProcess === child) directModelProcess = null;
  directModelPath = "";
}

async function ensureDirectModelRuntime(model) {
  if (await gatewayIsAvailable(DIRECT_MODEL_PORT) && directModelPath === model.modelPath) return true;
  await stopDirectModelRuntime();
  const directRuntimeRoot = storagePaths().directRuntimeRoot;
  const executable = findLlamaServer(directRuntimeRoot);
  if (!executable || !fs.existsSync(model.modelPath)) return false;
  const logRoot = path.join(directRuntimeRoot, "logs");
  fs.mkdirSync(logRoot, { recursive: true });
  directModelProcess = spawn(executable, buildLlamaServerArgs(model), {
    cwd: directRuntimeRoot,
    windowsHide: true,
    stdio: [
      "ignore",
      fs.openSync(path.join(logRoot, "server.log"), "a"),
      fs.openSync(path.join(logRoot, "server-error.log"), "a")
    ]
  });
  directModelPath = model.modelPath;
  directModelProcess.once("exit", () => {
    directModelProcess = null;
    directModelPath = "";
  });
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (await gatewayIsAvailable(DIRECT_MODEL_PORT)) return true;
    if (!directModelProcess) return false;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}
let activeImageJob = null;

function requestOcuJson(requestPath, method = "GET", payload = null, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const body = payload == null ? null : Buffer.from(JSON.stringify(payload), "utf8");
    const request = http.request(
      {
        host: APP_HOST,
        port: OCU_PORT,
        path: requestPath,
        method,
        timeout: timeoutMs,
        headers: body
          ? {
              "Content-Type": "application/json",
              "Content-Length": body.length
            }
          : undefined
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (error) {
            reject(new Error(`VELA API returned invalid JSON (${response.statusCode}).`));
            return;
          }
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(parsed?.error?.message ?? `VELA API failed (${response.statusCode}).`));
            return;
          }
          resolve(parsed);
        });
      }
    );
    request.once("timeout", () => request.destroy(new Error("VELA API timed out")));
    request.once("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

async function restartOcuApi() {
  if (ocuProcess && ocuProcess.exitCode === null) {
    const processToStop = ocuProcess;
    const stopped = new Promise((resolve) => processToStop.once("exit", resolve));
    processToStop.kill();
    await Promise.race([stopped, new Promise((resolve) => setTimeout(resolve, 3000))]);
  }
  ocuProcess = null;
  return ensureOcuApi();
}

async function ensureOcuApi() {
  if (ocuStartPromise) return ocuStartPromise;
  ocuStartPromise = (async () => {
    const startupConfig = readModelCenterConfig();
    if (startupConfig.primary.startsWith("direct/")) {
      const direct = startupConfig.directModels.find((item) => `direct/${item.id}` === startupConfig.primary);
      if (!direct || !await ensureDirectModelRuntime(direct)) return false;
    }
    // The full status route performs deep component checks and may exceed a
    // cold-start timeout even when the API is already listening. Prefer a
    // cheap loopback probe so desktop restarts never spawn duplicate servers.
    if (await gatewayIsAvailable(OCU_PORT)) return true;
    try {
      await requestOcuJson("/v1/status", "GET", null, 1200);
      return true;
    } catch {
      // Start the project's local API only when it is not already available.
    }

    const projectFile = path.join(VELA_PROJECT_ROOT, "pyproject.toml");
    if (!fs.existsSync(projectFile)) return false;
    if (!ocuProcess || ocuProcess.exitCode !== null) {
      try {
        const managedUv = await ensureManagedUv();
        const uvCandidates = [
          process.env.OCU_UV_PATH,
          managedUv,
          path.join(process.env.USERPROFILE ?? "", ".local", "bin", "uv.exe"),
          "uv"
        ].filter(Boolean);
        const uvCommand = uvCandidates.find((candidate) => candidate === "uv" || fs.existsSync(candidate)) ?? "uv";
        ocuProcess = spawn(
          uvCommand,
          ["run", "--no-dev", "--project", VELA_PROJECT_ROOT, "vela", "serve", "--host", APP_HOST, "--port", String(OCU_PORT)],
          {
            cwd: VELA_PROJECT_ROOT,
            windowsHide: true,
            stdio: "ignore",
            env: {
              ...process.env,
              ...modelRuntimeEnvironment(readModelCenterConfig(), decryptApiKey),
              ...permissionRuntimeEnvironment(
                loadPermissionConfig(permissionConfigPath()),
                VELA_PROJECT_ROOT
              ),
              ...pluginRuntimeEnvironment(
                loadPluginConfig(pluginConfigPath()),
                loadPermissionConfig(permissionConfigPath()).profile
              ),
              UV_PROJECT_ENVIRONMENT: path.join(storagePaths().runtimeRoot, "agent-venv"),
              UV_CACHE_DIR: path.join(storagePaths().cacheRoot, "uv"),
              OCU_OPENCLAW_ENABLED: "false",
              OCU_SESSION_DB_PATH: path.join(app.getPath("userData"), "sessions.db"),
              OCU_MEMORY_DB_PATH: path.join(app.getPath("userData"), "memory.db"),
              OCU_PLANNER_DB_PATH: path.join(app.getPath("userData"), "plans.db"),
              OCU_GOVERNANCE_DB_PATH: path.join(app.getPath("userData"), "governance.db")
            }
          }
        );
        ocuProcess.once("error", () => {
          ocuProcess = null;
        });
        ocuProcess.once("exit", () => {
          ocuProcess = null;
        });
      } catch {
        ocuProcess = null;
        return false;
      }
    }

    // A portable first launch creates the bundled Agent virtual environment
    // inside its extracted directory. On a busy or slower disk this can take
    // well beyond 12 seconds even though startup is healthy.
    const deadline = Date.now() + (app.isPackaged ? 60000 : 20000);
    while (Date.now() < deadline) {
      if (await gatewayIsAvailable(OCU_PORT)) return true;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    return false;
  })();
  try {
    return await ocuStartPromise;
  } finally {
    ocuStartPromise = null;
  }
}

async function ensureManagedUv() {
  const runtimeRoot = path.join(storagePaths().runtimeRoot, "uv");
  const executable = path.join(runtimeRoot, process.platform === "win32" ? "uv.exe" : "uv");
  if (fs.existsSync(executable)) return executable;
  const platformAsset = process.platform === "win32"
    ? "uv-x86_64-pc-windows-msvc.zip"
    : process.platform === "darwin" && process.arch === "arm64"
      ? "uv-aarch64-apple-darwin.tar.gz"
      : process.platform === "darwin"
        ? "uv-x86_64-apple-darwin.tar.gz"
        : "";
  if (!platformAsset) return "";
  const archive = path.join(runtimeRoot, platformAsset);
  fs.mkdirSync(runtimeRoot, { recursive: true });
  try {
    await downloadFile(
      `https://github.com/astral-sh/uv/releases/download/0.11.19/${platformAsset}`,
      archive,
      "runtime/uv"
    );
    if (process.platform === "win32") {
      await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Expand-Archive -LiteralPath '${archive.replaceAll("'", "''")}' -DestinationPath '${runtimeRoot.replaceAll("'", "''")}' -Force`], 120000);
    } else {
      await execFileAsync("tar", ["-xzf", archive, "--strip-components=1", "-C", runtimeRoot], 120000);
      if (fs.existsSync(executable)) fs.chmodSync(executable, 0o755);
    }
    return fs.existsSync(executable) ? executable : "";
  } catch (error) {
    console.error(`[VELA] Managed uv installation failed: ${error instanceof Error ? error.message : String(error)}`);
    return "";
  } finally {
    fs.rmSync(archive, { force: true });
  }
}

app.setAppUserModelId("local.vela.desktop");

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      if (window.isMinimized()) window.restore();
      if (!window.isVisible()) window.show();
      window.focus();
    }
  });

  app.whenReady().then(async () => {
    process.on("uncaughtException", (error) => {
      try { writeDiagnostic("uncaught-exception", { name: error?.name, message: error?.message, stack: error?.stack }); } catch { /* best effort */ }
    });
    process.on("unhandledRejection", (reason) => {
      try { writeDiagnostic("unhandled-rejection", { reason: reason instanceof Error ? { name: reason.name, message: reason.message, stack: reason.stack } : String(reason) }); } catch { /* best effort */ }
    });
    server = createServer();
    server.on("error", (error) => {
      console.error(error);
      app.quit();
    });
    server.listen(APP_PORT, APP_HOST, () => {
      createWindow();
      const window = BrowserWindow.getAllWindows()[0];
      window?.webContents.on("render-process-gone", (_event, details) => {
        try { writeDiagnostic("renderer-crash", details); } catch { /* best effort */ }
      });
      void ensureOcuApi().then((ready) => {
        if (!ready) console.error("[VELA] Agent Runtime remains offline; the desktop recovery UI is available.");
      });
    });
  });

  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    server?.close();
    if (ocuProcess && ocuProcess.exitCode === null) ocuProcess.kill();
    if (directModelProcess && directModelProcess.exitCode === null) directModelProcess.kill();
  });
}
