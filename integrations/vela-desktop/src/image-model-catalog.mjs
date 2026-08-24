import fs from "node:fs";
import path from "node:path";

export const IMAGE_MODEL_CATALOG = Object.freeze([
  {
    id: "anime",
    label: "Animagine XL 4.0",
    description: "动漫角色与二次元插画",
    tags: ["动漫", "角色", "插画"],
    engine: "native",
    recommended: true,
    assets: [{
      relativePath: path.join("checkpoints", "animagine-xl-4.0.safetensors"),
      url: "https://huggingface.co/cagliostrolab/animagine-xl-4.0/resolve/main/animagine-xl-4.0.safetensors?download=true",
      sha256: "1d5b43ff75b6ab598502d4c779d2fbfa3dceca51c60c3b609640a60772333916"
    }]
  },
  {
    id: "realistic",
    label: "RealVisXL V5.0",
    description: "真实摄影、人像与电影感",
    tags: ["写实", "人像", "摄影"],
    engine: "native",
    recommended: true,
    assets: [{
      relativePath: path.join("checkpoints", "RealVisXL_V5.0_fp16.safetensors"),
      url: "https://huggingface.co/SG161222/RealVisXL_V5.0/resolve/main/RealVisXL_V5.0_fp16.safetensors?download=true",
      sha256: "6a35a7855770ae9820a3c931d4964c3817b6d9e3c6f9c4dabb5b3a94e5643b80"
    }]
  },
  {
    id: "ssd1b",
    label: "SSD-1B",
    description: "更快的通用概念与草图生成",
    tags: ["快速", "通用", "低负载"],
    engine: "native",
    recommended: true,
    assets: [{
      relativePath: path.join("checkpoints", "SSD-1B-A1111.safetensors"),
      url: "https://huggingface.co/segmind/SSD-1B/resolve/main/SSD-1B-A1111.safetensors?download=true",
      sha256: "1895a00bfc769a00b0c0c43a95e433e79e9db8a85402b45a33e8448785bde94d"
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
      { relativePath: path.join("diffusion_models", "flux-2-klein-4b-fp8.safetensors") },
      { relativePath: path.join("text_encoders", "qwen_3_4b.safetensors") },
      { relativePath: path.join("vae", "flux2-vae.safetensors") }
    ]
  }
]);

export function imageModelCatalog(modelsRoot) {
  return IMAGE_MODEL_CATALOG.map((model) => {
    const files = model.assets.map((asset) => ({
      path: path.join(modelsRoot, asset.relativePath),
      installed: fs.existsSync(path.join(modelsRoot, asset.relativePath)),
      sizeBytes: fileSize(path.join(modelsRoot, asset.relativePath))
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

export function imageModelInstallAssets(modelId, modelsRoot) {
  const model = IMAGE_MODEL_CATALOG.find((item) => item.id === modelId);
  if (!model) throw new Error("Unknown image model.");
  if (!model.assets.every((asset) => Boolean(asset.url))) {
    throw new Error("This model bundle cannot be installed automatically yet.");
  }
  return model.assets.map((asset) => ({ ...asset, path: path.join(modelsRoot, asset.relativePath) }));
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}
