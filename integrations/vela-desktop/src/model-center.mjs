import fs from "node:fs";
import path from "node:path";

export const RECOMMENDED_LOCAL_MODELS = Object.freeze([
  { id: "qwen3:4b", label: "Qwen3 4B", size: "2.5 GB", use: "轻量聊天", fit: "推荐" },
  { id: "qwen3:8b", label: "Qwen3 8B", size: "5.2 GB", use: "综合 Agent", fit: "最佳" },
  { id: "qwen3-vl:4b", label: "Qwen3-VL 4B", size: "3.3 GB", use: "图片理解", fit: "推荐" },
  { id: "qwen3-embedding:0.6b", label: "Qwen3 Embedding", size: "约 0.6 GB", use: "记忆与知识库", fit: "推荐" }
]);

export const BUILTIN_PROVIDERS = Object.freeze([
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  { id: "openai", label: "OpenAI Compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-5-mini" },
  { id: "custom", label: "自定义 OpenAI Compatible", baseUrl: "", model: "" }
]);

export function defaultModelCenterConfig() {
  return {
    version: 2,
    primary: "ollama/qwen3:8b",
    providers: [],
    directModels: [],
    updatedAt: new Date().toISOString()
  };
}

export function loadModelCenterConfig(configPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return normalizeModelCenterConfig(parsed);
  } catch {
    return defaultModelCenterConfig();
  }
}

export function saveModelCenterConfig(configPath, config) {
  const normalized = normalizeModelCenterConfig(config);
  normalized.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const temporary = `${configPath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  fs.rmSync(configPath, { force: true });
  fs.renameSync(temporary, configPath);
  return normalized;
}

export function normalizeModelCenterConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  const providers = Array.isArray(source.providers)
    ? source.providers.map(normalizeProvider).filter(Boolean)
    : [];
  const directModels = Array.isArray(source.directModels)
    ? source.directModels.map(normalizeDirectModel).filter(Boolean)
    : [];
  return {
    version: 2,
    primary: String(source.primary || "ollama/qwen3:8b"),
    providers,
    directModels,
    updatedAt: String(source.updatedAt || new Date().toISOString())
  };
}

function normalizeDirectModel(value) {
  if (!value || typeof value !== "object") return null;
  const modelPath = path.resolve(String(value.modelPath || "").trim());
  if (path.extname(modelPath).toLowerCase() !== ".gguf") return null;
  const id = String(value.id || path.basename(modelPath, ".gguf"))
    .trim().replace(/[^a-z0-9_.-]/gi, "-").toLowerCase();
  if (!id) return null;
  return {
    id,
    label: String(value.label || path.basename(modelPath, ".gguf")).trim().slice(0, 120),
    modelPath,
    contextSize: Math.min(32768, Math.max(1024, Number(value.contextSize || 4096))),
    gpuLayers: Math.min(999, Math.max(0, Number(value.gpuLayers ?? 99)))
  };
}

function normalizeProvider(value) {
  if (!value || typeof value !== "object") return null;
  const id = String(value.id || "").trim().replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const baseUrl = String(value.baseUrl || "").trim().replace(/\/$/, "");
  const model = String(value.model || "").trim();
  if (!id || !baseUrl || !model || !/^https?:\/\//i.test(baseUrl)) return null;
  return {
    id,
    label: String(value.label || id).trim().slice(0, 80),
    baseUrl,
    model,
    encryptedApiKey: String(value.encryptedApiKey || ""),
    enabled: value.enabled !== false
  };
}

export function publicModelCenterConfig(config) {
  return {
    ...config,
    providers: config.providers.map(({ encryptedApiKey, ...provider }) => ({
      ...provider,
      hasApiKey: Boolean(encryptedApiKey)
    })),
    recommended: RECOMMENDED_LOCAL_MODELS,
    providerTemplates: BUILTIN_PROVIDERS
  };
}

export function modelRuntimeEnvironment(config, decryptApiKey = () => "") {
  const primary = String(config.primary || "ollama/qwen3:8b");
  if (primary.startsWith("direct/")) {
    const direct = config.directModels.find((item) => `direct/${item.id}` === primary);
    if (!direct) throw new Error(`Configured direct model is unavailable: ${primary}`);
    return {
      OCU_OLLAMA_BASE_URL: "http://127.0.0.1:11435",
      OCU_OLLAMA_MODEL: direct.id,
      OCU_OLLAMA_API_KEY: "vela-local"
    };
  }
  if (primary.startsWith("ollama/")) {
    return {
      OCU_OLLAMA_BASE_URL: "http://127.0.0.1:11434",
      OCU_OLLAMA_MODEL: primary.slice("ollama/".length),
      OCU_OLLAMA_API_KEY: "ollama"
    };
  }
  const [providerId] = primary.split("/", 1);
  const provider = config.providers.find((item) => item.id === providerId && item.enabled);
  if (!provider) throw new Error(`Configured provider is unavailable: ${providerId}`);
  const apiKey = decryptApiKey(provider.encryptedApiKey);
  if (!apiKey) throw new Error(`${provider.label} API key is missing.`);
  return {
    OCU_OLLAMA_BASE_URL: provider.baseUrl,
    OCU_OLLAMA_MODEL: provider.model,
    OCU_OLLAMA_API_KEY: apiKey
  };
}
