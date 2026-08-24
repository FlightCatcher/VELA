import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultModelCenterConfig,
  modelRuntimeEnvironment,
  normalizeModelCenterConfig,
  publicModelCenterConfig
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
