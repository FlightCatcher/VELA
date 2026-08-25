import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DIRECT_MODEL_PORT = 11435;
export const DIRECT_MODEL_ROOTS = Object.freeze([
  "E:\\AI-Models",
  "D:\\AI-Models-HotCache\\Models"
]);

function portableBasename(filePath) {
  return filePath.includes("\\") ? path.win32.basename(filePath) : path.posix.basename(filePath);
}

export function directModelId(modelPath) {
  const basename = portableBasename(modelPath);
  const name = basename.slice(0, basename.length - path.extname(basename).length)
    .replace(/[^a-z0-9_.-]/gi, "-").toLowerCase();
  const suffix = crypto.createHash("sha1").update(path.resolve(modelPath)).digest("hex").slice(0, 8);
  return `${name}-${suffix}`;
}

export function discoverGgufModels(roots = DIRECT_MODEL_ROOTS, maxDepth = 5) {
  const models = [];
  const visit = (directory, depth) => {
    if (depth > maxDepth || !fs.existsSync(directory)) return;
    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(candidate, depth + 1);
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".gguf") continue;
      const stat = fs.statSync(candidate);
      models.push({
        id: directModelId(candidate),
        label: path.basename(candidate, ".gguf"),
        modelPath: candidate,
        sizeBytes: stat.size,
        contextSize: 4096,
        gpuLayers: 99
      });
    }
  };
  for (const root of roots) visit(root, 0);
  return models.sort((left, right) => left.label.localeCompare(right.label));
}

export function findLlamaServer(runtimeRoot, platform = process.platform) {
  const executable = platform === "win32" ? "llama-server.exe" : "llama-server";
  const candidates = [
    path.join(runtimeRoot, executable),
    path.join(runtimeRoot, "bin", executable),
    path.join(runtimeRoot, "build", "bin", executable)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

export function buildLlamaServerArgs(model, port = DIRECT_MODEL_PORT) {
  if (!model?.modelPath || path.extname(model.modelPath).toLowerCase() !== ".gguf") {
    throw new Error("A valid GGUF model path is required.");
  }
  return [
    "--model", model.modelPath,
    "--alias", model.id,
    "--host", "127.0.0.1",
    "--port", String(port),
    "--ctx-size", String(model.contextSize || 4096),
    "--n-gpu-layers", String(model.gpuLayers ?? 99),
    "--parallel", "1",
    "--ctx-checkpoints", "0"
  ];
}
