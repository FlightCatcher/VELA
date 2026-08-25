const GB = 1024 ** 3;

export function buildSystemProfile({ platform, arch, totalMemoryBytes, freeMemoryBytes, freeDiskBytes, gpus = [], online = true }) {
  const normalizedGpus = gpus.map((gpu) => ({
    name: String(gpu?.name || "Unknown GPU").trim(),
    vendor: String(gpu?.vendor || inferGpuVendor(gpu?.name)).toLowerCase(),
    memoryGb: finiteNumber(gpu?.memoryGb)
  }));
  const totalMemoryGb = roundGb(totalMemoryBytes);
  const freeMemoryGb = roundGb(freeMemoryBytes);
  const freeDiskGb = freeDiskBytes == null ? null : roundGb(freeDiskBytes);
  const appleSilicon = platform === "darwin" && arch === "arm64";
  const nvidia = normalizedGpus.find((gpu) => gpu.vendor === "nvidia") || null;
  const accelerator = nvidia ? "cuda" : appleSilicon ? "metal" : normalizedGpus.length ? "cpu-gpu" : "cpu";
  const warnings = [];
  if (!online) warnings.push({ code: "offline", level: "warning", message: "当前离线；已安装模型仍可使用，新的模型下载需要联网。" });
  if (totalMemoryGb < 8) warnings.push({ code: "low-memory", level: "error", message: "内存低于 8 GB，仅建议使用 API 模型或 1B–2B 本地模型。" });
  else if (totalMemoryGb < 16) warnings.push({ code: "limited-memory", level: "warning", message: "内存不足 16 GB，建议使用 3B–4B 量化模型并避免同时运行生图。" });
  if (!nvidia && !appleSilicon) warnings.push({ code: "no-accelerator", level: "info", message: "未发现 NVIDIA 或 Apple Silicon；本地模型将以 CPU/通用 GPU 模式运行，速度可能较慢。" });
  if (freeDiskGb != null && freeDiskGb < 12) warnings.push({ code: "low-disk", level: "error", message: "模型盘剩余空间不足 12 GB，请更换数据目录后再下载模型。" });
  else if (freeDiskGb != null && freeDiskGb < 30) warnings.push({ code: "limited-disk", level: "warning", message: "模型盘空间较少，建议只安装一个轻量对话模型。" });

  return {
    platform,
    arch,
    totalMemoryGb,
    freeMemoryGb,
    freeDiskGb,
    gpus: normalizedGpus,
    accelerator,
    online: Boolean(online),
    warnings,
    recommendations: recommendModels({ totalMemoryGb, freeDiskGb, accelerator, nvidiaMemoryGb: nvidia?.memoryGb })
  };
}

export function recommendModels({ totalMemoryGb, freeDiskGb, accelerator, nvidiaMemoryGb = null }) {
  const disk = freeDiskGb == null ? Infinity : freeDiskGb;
  if (totalMemoryGb < 8 || disk < 6) {
    return [{ id: "api", label: "云端 API", reason: "当前硬件不适合稳定运行常规模型", preferred: true }];
  }
  const result = [];
  if (totalMemoryGb >= 16 && disk >= 8) {
    result.push({ id: "qwen3:8b", label: "Qwen3 8B", reason: "中文、推理与工具能力均衡", preferred: accelerator === "cuda" && (nvidiaMemoryGb == null || nvidiaMemoryGb >= 7) });
  }
  if (totalMemoryGb >= 8 && disk >= 5) {
    result.push({ id: "qwen3-4b-q4", label: "Qwen3 4B Q4（直连）", reason: "无需 Ollama，适合首次安装与低负载运行", preferred: !result.some((item) => item.preferred) });
  }
  if (totalMemoryGb >= 8 && disk >= 4) {
    result.push({ id: "gemma3:4b", label: "Gemma 3 4B", reason: "轻量多语言与图片理解", preferred: false });
  }
  if (!result.length) result.push({ id: "api", label: "云端 API", reason: "磁盘空间不足以安全下载本地模型", preferred: true });
  return result;
}

function inferGpuVendor(name = "") {
  const value = String(name).toLowerCase();
  if (value.includes("nvidia") || value.includes("geforce") || value.includes("rtx") || value.includes("gtx")) return "nvidia";
  if (value.includes("apple")) return "apple";
  if (value.includes("amd") || value.includes("radeon")) return "amd";
  if (value.includes("intel")) return "intel";
  return "unknown";
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function roundGb(bytes) {
  return Number((Number(bytes || 0) / GB).toFixed(1));
}
