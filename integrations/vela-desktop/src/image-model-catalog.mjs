import fs from "node:fs";
import path from "node:path";

const HOT_ROOT = "D:\\AI-Models-HotCache\\Models";

export const IMAGE_MODEL_CATALOG = Object.freeze([
  {
    id: "anime",
    label: "Animagine XL 4.0",
    description: "动漫角色与二次元插画",
    tags: ["动漫", "角色", "插画"],
    engine: "native",
    recommended: true,
    assets: [{
      path: path.join(HOT_ROOT, "checkpoints", "animagine-xl-4.0.safetensors"),
      url: "https://huggingface.co/cagliostrolab/animagine-xl-4.0/resolve/main/animagine-xl-4.0.safetensors?download=true"
    }]
  },
  {
    id: "realistic",
    label: "Juggernaut XL v9",
    description: "真实摄影、人像与电影感",
    tags: ["写实", "人像", "摄影"],
    engine: "native",
    recommended: true,
    assets: [{ path: path.join(HOT_ROOT, "checkpoints", "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors") }]
  },
  {
    id: "ssd1b",
    label: "SSD-1B",
    description: "更快的通用概念与草图生成",
    tags: ["快速", "通用", "低负载"],
    engine: "native",
    recommended: true,
    assets: [{
      path: path.join(HOT_ROOT, "checkpoints", "SSD-1B-A1111.safetensors"),
      url: "https://huggingface.co/segmind/SSD-1B/resolve/main/SSD-1B-A1111.safetensors?download=true"
    }]
  },
  {
    id: "flux2",
    label: "FLUX.2 Klein 4B",
    description: "多参考编辑与陌生角色还原",
    tags: ["参考图", "编辑", "角色还原"],
    engine: "comfy",
    recommended: false,
    assets: [
      { path: path.join(HOT_ROOT, "diffusion_models", "flux-2-klein-4b-fp8.safetensors") },
      { path: path.join(HOT_ROOT, "text_encoders", "qwen_3_4b.safetensors") },
      { path: path.join(HOT_ROOT, "vae", "flux2-vae.safetensors") }
    ]
  }
]);

export function imageModelCatalog() {
  return IMAGE_MODEL_CATALOG.map((model) => {
    const files = model.assets.map((asset) => ({
      path: asset.path,
      installed: fs.existsSync(asset.path),
      sizeBytes: fileSize(asset.path)
    }));
    const installed = files.every((file) => file.installed);
    return {
      id: model.id,
      label: model.label,
      description: model.description,
      tags: model.tags,
      engine: model.engine,
      recommended: model.recommended,
      installed,
      installable: !installed && model.assets.every((asset) => Boolean(asset.url)),
      sizeBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
      files
    };
  });
}

export function imageModelInstallAssets(modelId) {
  const model = IMAGE_MODEL_CATALOG.find((item) => item.id === modelId);
  if (!model) throw new Error("Unknown image model.");
  if (!model.assets.every((asset) => Boolean(asset.url))) {
    throw new Error("This model bundle cannot be installed automatically yet.");
  }
  return model.assets;
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}
