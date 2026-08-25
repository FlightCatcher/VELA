import fs from "node:fs";
import path from "node:path";

export const RECOMMENDED_LOCAL_MODELS = Object.freeze([
  { id: "qwen3.5:4b", label: "Qwen 3.5 4B", size: "3.4 GB", use: "中文、视觉与工具", fit: "推荐", category: "general", capabilities: ["对话", "看图", "工具"] },
  { id: "qwen3.5:9b", label: "Qwen 3.5 9B", size: "6.6 GB", use: "高质量综合 Agent", fit: "8 GB 显存上限", category: "agent", capabilities: ["推理", "看图", "工具"] },
  { id: "qwen3:8b", label: "Qwen3 8B", size: "5.2 GB", use: "稳定中文 Agent", fit: "最佳", category: "agent", capabilities: ["对话", "推理", "工具"] },
  { id: "deepseek-r1:8b", label: "DeepSeek R1 8B", size: "约 5.2 GB", use: "数学与复杂推理", fit: "推荐", category: "reasoning", capabilities: ["推理", "数学"] },
  { id: "qwen2.5-coder:7b", label: "Qwen 2.5 Coder 7B", size: "4.7 GB", use: "代码生成、修复与解释", fit: "推荐", category: "coding", capabilities: ["编程", "修复"] },
  { id: "gemma3:4b", label: "Gemma 3 4B", size: "3.3 GB", use: "多语言与图片理解", fit: "轻量", category: "vision", capabilities: ["看图", "多语言"] },
  { id: "phi4-mini:3.8b", label: "Phi-4 Mini", size: "2.5 GB", use: "数学、逻辑与函数调用", fit: "轻量", category: "reasoning", capabilities: ["推理", "数学", "工具"] },
  { id: "llama3.2:3b", label: "Llama 3.2 3B", size: "2.0 GB", use: "摘要、改写与轻量工具", fit: "极速", category: "general", capabilities: ["摘要", "改写", "工具"] },
  { id: "qwen3-embedding:0.6b", label: "Qwen3 Embedding", size: "约 0.6 GB", use: "中文记忆与知识库", fit: "推荐", category: "embedding", capabilities: ["向量", "RAG"] },
  { id: "nomic-embed-text", label: "Nomic Embed Text", size: "约 0.3 GB", use: "英文语义检索", fit: "轻量", category: "embedding", capabilities: ["向量", "RAG"] }
]);

export const BUILTIN_PROVIDERS = Object.freeze([
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  { id: "minimax", label: "MiniMax M2.7", baseUrl: "https://api.minimax.io/v1", model: "MiniMax-M2.7" },
  { id: "minimax-fast", label: "MiniMax M2.7 Highspeed", baseUrl: "https://api.minimax.io/v1", model: "MiniMax-M2.7-highspeed" },
  { id: "gemini", label: "Gemini 3.7 Flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.7-flash" },
  { id: "gemini-pro", label: "Gemini 3.1 Pro", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.1-pro-preview" },
  { id: "mistral", label: "Mistral", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest" },
  { id: "openrouter", label: "OpenRouter · 自动路由", baseUrl: "https://openrouter.ai/api/v1", model: "~openai/gpt-latest" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-5-mini" },
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
