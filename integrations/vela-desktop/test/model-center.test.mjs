import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILTIN_PROVIDERS,
  defaultModelCenterConfig,
  modelRuntimeEnvironment,
  normalizeModelCenterConfig,
  publicModelCenterConfig,
  RECOMMENDED_LOCAL_MODELS
} from "../src/model-center.mjs";

test("default model center uses the local agent model", () => {
  assert.equal(defaultModelCenterConfig().primary, "ollama/qwen3:8b");
});

test("invalid providers are rejected", () => {
  const config = normalizeModelCenterConfig({ providers: [{ id: "bad", baseUrl: "file://x", model: "x" }] });
  assert.deepEqual(config.providers, []);
});

test("public model configuration never exposes encrypted keys", () => {
  const config = normalizeModelCenterConfig({
    providers: [{ id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", encryptedApiKey: "cipher" }]
  });
  const visible = publicModelCenterConfig(config);
  assert.equal(visible.providers[0].hasApiKey, true);
  assert.equal("encryptedApiKey" in visible.providers[0], false);
});

test("runtime environment routes local and API models", () => {
  assert.equal(modelRuntimeEnvironment(defaultModelCenterConfig()).OCU_OLLAMA_MODEL, "qwen3:8b");
  const config = normalizeModelCenterConfig({
    primary: "deepseek/deepseek-chat",
    providers: [{ id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", encryptedApiKey: "cipher" }]
  });
  const environment = modelRuntimeEnvironment(config, () => "secret");
  assert.equal(environment.OCU_OLLAMA_BASE_URL, "https://api.deepseek.com");
  assert.equal(environment.OCU_OLLAMA_API_KEY, "secret");
});

test("runtime environment routes a direct GGUF model without Ollama", () => {
  const config = normalizeModelCenterConfig({
    primary: "direct/qwen-direct",
    directModels: [{ id: "qwen-direct", modelPath: "E:\\AI-Models\\qwen.gguf" }]
  });
  const environment = modelRuntimeEnvironment(config);
  assert.equal(environment.OCU_OLLAMA_BASE_URL, "http://127.0.0.1:11435");
  assert.equal(environment.OCU_OLLAMA_MODEL, "qwen-direct");
});

test("public catalog covers the major local capability categories", () => {
  const categories = new Set(RECOMMENDED_LOCAL_MODELS.map((item) => item.category));
  assert.deepEqual(categories, new Set(["general", "agent", "reasoning", "coding", "vision", "embedding"]));
  assert.ok(RECOMMENDED_LOCAL_MODELS.every((item) => item.capabilities.length > 0));
});

test("built-in cloud catalog includes current MiniMax and Gemini endpoints", () => {
  const minimax = BUILTIN_PROVIDERS.find((item) => item.id === "minimax");
  const gemini = BUILTIN_PROVIDERS.find((item) => item.id === "gemini");
  assert.equal(minimax.model, "MiniMax-M2.7");
  assert.equal(minimax.baseUrl, "https://api.minimax.io/v1");
  assert.equal(gemini.model, "gemini-3.7-flash");
  assert.equal(gemini.baseUrl, "https://generativelanguage.googleapis.com/v1beta/openai");
});
