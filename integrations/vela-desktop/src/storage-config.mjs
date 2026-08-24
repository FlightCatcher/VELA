import fs from "node:fs";
import path from "node:path";

export function defaultStorageConfig(documentsRoot) {
  const root = path.resolve(process.env.VELA_DATA_ROOT || path.join(documentsRoot, "VELA"));
  return storageConfigFromRoot(root, false);
}

export function storageConfigFromRoot(root, configured = true) {
  const dataRoot = path.resolve(String(root || "").trim());
  if (!path.isAbsolute(dataRoot)) throw new Error("VELA data directory must be an absolute path.");
  return {
    version: 1,
    configured,
    dataRoot,
    modelsRoot: path.join(dataRoot, "Models"),
    runtimeRoot: path.join(dataRoot, "Runtimes"),
    cacheRoot: path.join(dataRoot, "Cache"),
    outputRoot: path.join(dataRoot, "Outputs"),
    backupRoot: path.join(dataRoot, "Backups")
  };
}

export function loadStorageConfig(configPath, documentsRoot) {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return storageConfigFromRoot(parsed.dataRoot, parsed.configured !== false);
  } catch {
    return defaultStorageConfig(documentsRoot);
  }
}

export function saveStorageConfig(configPath, value) {
  const config = storageConfigFromRoot(value.dataRoot, true);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.mkdirSync(config.dataRoot, { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

export function ensureStorageDirectories(config) {
  for (const directory of [config.dataRoot, config.modelsRoot, config.runtimeRoot, config.cacheRoot, config.outputRoot, config.backupRoot]) {
    fs.mkdirSync(directory, { recursive: true });
  }
}
