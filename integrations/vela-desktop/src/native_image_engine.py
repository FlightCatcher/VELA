# ruff: noqa: I001
"""VELA native local image inference.

This worker intentionally does not import or start ComfyUI.  It loads the
existing single-file SDXL checkpoints directly with Diffusers and writes a
small JSON result for the Electron host.
"""

from __future__ import annotations

import base64
import gc
import json
import os
import sys
import time
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

PACKAGE_ROOT = Path(r"D:\AI-Models-HotCache\VELA-ImageEngine\python_packages")
if PACKAGE_ROOT.exists():
    sys.path.insert(0, str(PACKAGE_ROOT))

os.environ.setdefault("HF_HOME", r"D:\AI-Models-HotCache\VELA-ImageEngine\cache")
os.environ.setdefault("HF_HUB_CACHE", r"D:\AI-Models-HotCache\VELA-ImageEngine\cache\hub")
os.environ.setdefault("TRANSFORMERS_CACHE", r"D:\AI-Models-HotCache\VELA-ImageEngine\cache\transformers")

import torch
from diffusers import StableDiffusionXLImg2ImgPipeline, StableDiffusionXLPipeline
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps, ImageStat


MODEL_ROOT = Path(r"D:\AI-Models-HotCache\Models\checkpoints")
OUTPUT_ROOT = Path(r"E:\AI-Models\Image-Generation\Outputs\VELA-Native")
MODELS = {
    # The previous "opt" checkpoint produced corrupted abstract color blocks
    # under Diffusers. Use the verified original checkpoint instead.
    "anime": MODEL_ROOT / "animagine-xl-4.0.safetensors",
    "realistic": MODEL_ROOT / "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors",
    "ssd1b": MODEL_ROOT / "SSD-1B-A1111.safetensors",
}
_PIPELINE: StableDiffusionXLPipeline | None = None
_PIPELINE_ENGINE = ""


def _load_reference(attachments: list[dict], target_size: tuple[int, int]) -> tuple[Image.Image | None, int]:
    references: list[Image.Image] = []
    for attachment in attachments:
        if attachment.get("type") != "image" or not attachment.get("content"):
            continue
        raw = str(attachment["content"])
        if "," in raw and raw.startswith("data:"):
            raw = raw.split(",", 1)[1]
        from io import BytesIO

        references.append(Image.open(BytesIO(base64.b64decode(raw))).convert("RGB"))
        if len(references) == 2:
            break
    if not references:
        return None, 0

    width, height = target_size
    canvas = Image.new("RGB", target_size, (224, 232, 216))
    if len(references) == 1:
        fitted = ImageOps.contain(references[0], target_size, Image.Resampling.LANCZOS)
        canvas.paste(fitted, ((width - fitted.width) // 2, (height - fitted.height) // 2))
    else:
        # Build one shared scene guide instead of a hard two-panel contact
        # sheet. A hard center boundary survives img2img and produces a
        # collage rather than two characters standing in the same scene.
        pixels = canvas.load()
        for y in range(height):
            blend = y / max(1, height - 1)
            color = (int(218 - 36 * blend), int(230 - 20 * blend), int(205 - 34 * blend))
            for x in range(width):
                pixels[x, y] = color
        guide = ImageDraw.Draw(canvas)
        for x in range(width // 12, width, max(24, width // 9)):
            guide.rounded_rectangle(
                (x, 0, min(width, x + max(5, width // 80)), height),
                radius=max(2, width // 160),
                fill=(151, 177, 132),
            )
        cell_width = int(width * 0.46)
        cell_height = int(height * 0.82)
        for index, reference in enumerate(references):
            fitted = ImageOps.contain(reference, (cell_width, cell_height), Image.Resampling.LANCZOS)
            left = int(width * (0.04 if index == 0 else 0.50)) + (cell_width - fitted.width) // 2
            top = (height - fitted.height) // 2
            mask = Image.new("L", fitted.size, 0)
            ImageDraw.Draw(mask).rounded_rectangle(
                (8, 8, fitted.width - 9, fitted.height - 9),
                radius=max(18, min(fitted.size) // 7),
                fill=255,
            )
            mask = mask.filter(ImageFilter.GaussianBlur(radius=max(10, min(fitted.size) // 20)))
            canvas.paste(fitted, (left, top), mask)
    for reference in references:
        reference.close()
    return canvas, len(references)


def _clip_safe_text(pipe: StableDiffusionXLPipeline, value: str) -> tuple[str, int, bool]:
    """Truncate using the model tokenizer instead of a misleading word count."""
    tokenizer = pipe.tokenizer
    encoded = tokenizer(value, truncation=False, add_special_tokens=True)["input_ids"]
    token_count = len(encoded)
    if token_count <= tokenizer.model_max_length:
        return value, token_count, False
    safe = tokenizer(
        value,
        truncation=True,
        max_length=tokenizer.model_max_length,
        add_special_tokens=True,
    )["input_ids"]
    decoded = tokenizer.decode(safe, skip_special_tokens=True).strip()
    return decoded, token_count, True


def _target_size(settings: dict) -> tuple[int, int]:
    aspect = str(settings.get("aspect", "landscape"))
    return {
        "square": (768, 768),
        "landscape": (768, 432),
        "portrait": (432, 768),
        "classic": (768, 576),
        "vertical": (576, 768),
        "photo": (768, 512),
    }.get(aspect, (768, 432))


def _output_size(settings: dict, original: tuple[int, int]) -> tuple[int, int]:
    quality = str(settings.get("quality", "high"))
    if quality == "standard":
        return original
    aspect = str(settings.get("aspect", "landscape"))
    sizes = {
        "high": {
            "square": (2048, 2048), "landscape": (2560, 1440),
            "portrait": (1440, 2560), "classic": (2560, 1920),
            "vertical": (1920, 2560), "photo": (2560, 1707),
        },
        "ultra": {
            "square": (3840, 3840), "landscape": (3840, 2160),
            "portrait": (2160, 3840), "classic": (3840, 2880),
            "vertical": (2880, 3840), "photo": (3840, 2560),
        },
    }
    return sizes.get(quality, sizes["high"]).get(aspect, sizes.get(quality, sizes["high"])["landscape"])


def _steps(settings: dict, engine: str) -> int:
    quality = str(settings.get("quality", "high"))
    if engine == "ssd1b":
        return {"standard": 6, "high": 10, "ultra": 14}.get(quality, 10)
    return {"standard": 12, "high": 22, "ultra": 30}.get(quality, 22)


def _validate_and_normalize(image: Image.Image, prompt: str) -> tuple[Image.Image, dict]:
    """Reject unusable output and enforce explicit palette constraints."""
    rgb = image.convert("RGB")
    gray = ImageOps.grayscale(rgb)
    contrast = float(ImageStat.Stat(gray).stddev[0])
    if contrast < 3.0:
        raise RuntimeError("Generated image is nearly blank; please retry with a different seed")
    center = rgb.width // 2
    left_column = rgb.crop((max(0, center - 1), 0, center, rgb.height))
    right_column = rgb.crop((center, 0, min(rgb.width, center + 1), rgb.height))
    seam = float(sum(ImageStat.Stat(ImageChops.difference(left_column, right_column)).mean) / 3)
    baselines = []
    for offset in (max(2, rgb.width // 16), max(4, rgb.width // 8)):
        for x in (max(1, center - offset), min(rgb.width - 2, center + offset)):
            a = rgb.crop((x - 1, 0, x, rgb.height))
            b = rgb.crop((x, 0, x + 1, rgb.height))
            baselines.append(float(sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3))
    baseline = sum(baselines) / max(1, len(baselines))
    split_panel_detected = seam > 6.0 and seam > max(3.0 * baseline, baseline + 4.0)
    monochrome_requested = "strict monochrome" in prompt.lower() or "black, white and gray palette" in prompt.lower()
    monochrome_applied = False
    if monochrome_requested:
        rgb = gray.convert("RGB")
        monochrome_applied = True
    return rgb, {
        "passed": True,
        "contrast": round(contrast, 2),
        "centerSeam": round(seam, 2),
        "centerSeamBaseline": round(baseline, 2),
        "splitPanelDetected": split_panel_detected,
        "monochromeApplied": monochrome_applied,
    }


def _load_pipeline(engine: str, model_path: Path) -> StableDiffusionXLPipeline:
    if not model_path.exists():
        raise FileNotFoundError(f"Local model is missing: {model_path}")
    options = {
        "torch_dtype": torch.float16,
        "use_safetensors": True,
        "local_files_only": False,
        "low_cpu_mem_usage": True,
    }
    if engine == "ssd1b":
        options["config"] = "segmind/SSD-1B"
    pipe = StableDiffusionXLPipeline.from_single_file(str(model_path), **options)
    pipe.enable_attention_slicing("max")
    pipe.enable_vae_slicing()
    pipe.enable_vae_tiling()
    # 8 GB cards cannot keep all SDXL components resident at once.  Model CPU
    # offload moves only the active component to CUDA and avoids hard OOMs.
    pipe.enable_model_cpu_offload()
    return pipe


def _get_pipeline(engine: str, model_path: Path) -> StableDiffusionXLPipeline:
    global _PIPELINE, _PIPELINE_ENGINE
    if _PIPELINE is not None and _PIPELINE_ENGINE == engine:
        return _PIPELINE
    if _PIPELINE is not None:
        del _PIPELINE
        _PIPELINE = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    _PIPELINE = _load_pipeline(engine, model_path)
    _PIPELINE_ENGINE = engine
    return _PIPELINE


def generate(request: dict) -> dict:
    started = time.perf_counter()
    settings = request.get("settings") or {}
    requested_engine = str(settings.get("engine", "anime")).lower()
    engine = requested_engine if requested_engine in MODELS else "anime"
    model_path = MODELS[engine]
    width, height = _target_size(settings)
    seed = int(settings.get("seed") or int.from_bytes(os.urandom(4), "little") % 2_147_483_647)
    prompt = str(request.get("prompt", "")).strip()
    if not prompt:
        raise ValueError("Image prompt is empty")

    pipe = _get_pipeline(engine, model_path)
    prompt, prompt_token_count, prompt_truncated = _clip_safe_text(pipe, prompt)
    negative_prompt, _, _ = _clip_safe_text(
        pipe,
        str(settings.get("negativePrompt") or "low quality, blurry, malformed, extra limbs, duplicate, text, watermark, logo"),
    )
    reference, reference_count = _load_reference(request.get("attachments") or [], (width, height))
    reference_used = reference is not None
    common = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "num_inference_steps": _steps(settings, engine),
        "guidance_scale": 5.5 if engine != "anime" else 5.0,
        "generator": torch.Generator(device="cpu").manual_seed(seed),
    }
    if reference is not None and str(settings.get("reference", "smart")) != "off":
        img_pipe = StableDiffusionXLImg2ImgPipeline(**pipe.components)
        img_pipe.enable_attention_slicing("max")
        img_pipe.enable_vae_slicing()
        img_pipe.enable_vae_tiling()
        img_pipe.enable_model_cpu_offload()
        strength = 0.28 if str(settings.get("reference")) == "strict" else 0.60 if reference_count > 1 else 0.38
        image = img_pipe(image=reference, strength=strength, **common).images[0]
    else:
        image = pipe(width=width, height=height, **common).images[0]

    image, quality_checks = _validate_and_normalize(image, prompt)

    output_width, output_height = _output_size(settings, image.size)
    if (output_width, output_height) != image.size:
        image = image.resize((output_width, output_height), Image.Resampling.LANCZOS)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    filename = f"VELA-{engine}-{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}.png"
    output_path = OUTPUT_ROOT / filename
    image.save(output_path, format="PNG", optimize=True)

    if reference is not None:
        del reference
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    return {
        "promptId": f"native-{uuid.uuid4()}",
        "engine": engine,
        "route": "realistic" if engine == "realistic" else "general" if engine == "ssd1b" else "anime",
        "backend": "vela-native",
        "referenceUsed": reference_used,
        "width": output_width,
        "height": output_height,
        "resolution": "4K" if str(settings.get("quality")) == "ultra" else "2K" if str(settings.get("quality")) == "high" else "HD",
        "upscaled": (output_width, output_height) != (width, height),
        "elapsedSeconds": round(time.perf_counter() - started, 2),
        "qualityChecks": quality_checks,
        "promptTokenCount": prompt_token_count,
        "promptTruncated": prompt_truncated,
        "referenceCount": reference_count,
        "upscaleMethod": "lanczos" if (output_width, output_height) != (width, height) else None,
        "outputs": [{
            "filename": filename,
            "path": str(output_path),
            "viewUrl": f"/media?path={output_path!s}",
        }],
    }


class NativeImageHandler(BaseHTTPRequestHandler):
    server_version = "VELANativeImage/1.0"

    def log_message(self, _format: str, *_args: object) -> None:
        return

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        self.server.last_activity = time.monotonic()  # type: ignore[attr-defined]
        if self.path == "/health":
            self._json(200, {"ok": True, "backend": "vela-native", "loadedEngine": _PIPELINE_ENGINE or None})
            return
        self._json(404, {"ok": False, "error": "Not found"})

    def do_POST(self) -> None:
        self.server.last_activity = time.monotonic()  # type: ignore[attr-defined]
        if self.path != "/generate":
            self._json(404, {"ok": False, "error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            request = json.loads(self.rfile.read(length).decode("utf-8"))
            self._json(200, {"ok": True, "result": generate(request)})
        except Exception as error:  # noqa: BLE001 - HTTP boundary must serialize worker failures
            self._json(500, {"ok": False, "error": f"{type(error).__name__}: {error}"})


def serve(port: int) -> int:
    server = HTTPServer(("127.0.0.1", port), NativeImageHandler)
    server.timeout = 30
    server.last_activity = time.monotonic()  # type: ignore[attr-defined]
    while True:
        server.handle_request()
        # Exit after five idle minutes. VELA restarts it on demand, keeping the
        # machine light when image generation is not in use.
        if time.monotonic() - server.last_activity >= 300:  # type: ignore[attr-defined]
            break
    return 0


def main() -> int:
    if len(sys.argv) == 3 and sys.argv[1] == "--server":
        return serve(int(sys.argv[2]))
    if len(sys.argv) != 3:
        print("usage: native_image_engine.py REQUEST_JSON RESULT_JSON", file=sys.stderr)
        return 2
    request_path = Path(sys.argv[1])
    result_path = Path(sys.argv[2])
    try:
        result = {"ok": True, "result": generate(json.loads(request_path.read_text(encoding="utf-8")))}
    except Exception as error:  # noqa: BLE001 - CLI boundary must serialize worker failures
        result = {"ok": False, "error": f"{type(error).__name__}: {error}"}
    result_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
