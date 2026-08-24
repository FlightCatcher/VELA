import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const baseUrl = "http://127.0.0.1:8188";
const workflowPath = "C:\\AI-Apps\\OpenClaw-Workflows\\animagine-reference-api.json";
const tests = [
  ["baize-fast", "有兽焉 白泽 角色 设定图"],
  ["diting-fast", "有兽焉 谛听 角色 设定图"],
  ["dijiang-fast", "有兽焉 帝江 角色 设定图"]
];

function decodeHtml(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\\u002f/g, "/");
}

function extractImageUrls(html) {
  const urls = [];
  const patterns = [
    /murl(?:&quot;|"):\s*(?:&quot;|")(.*?)(?:&quot;|")/g,
    /"murl":"(.*?)"/g
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const candidate = decodeHtml(match[1]);
      try {
        const url = new URL(candidate);
        if (/^https?:$/.test(url.protocol) && !urls.includes(candidate)) urls.push(candidate);
      } catch {
        // Skip malformed search results.
      }
      if (urls.length >= 8) return urls;
    }
  }
  return urls;
}

async function searchReferences(query) {
  const response = await fetch(
    `https://www.bing.com/images/search?q=${encodeURIComponent(`${query} 插画`)}`,
    { headers: { "User-Agent": "Mozilla/5.0 VELA/1.0" }, signal: AbortSignal.timeout(15000) }
  );
  if (!response.ok) throw new Error(`Reference search failed (${response.status}).`);
  const urls = extractImageUrls(await response.text());
  if (!urls.length) throw new Error("No reference image found.");
  return urls;
}

async function downloadReference(url, directory) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 VELA/1.0", Accept: "image/*" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok || !String(response.headers.get("content-type") ?? "").startsWith("image/")) {
    throw new Error("Search result is not a downloadable image.");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 12 * 1024 * 1024) throw new Error("Reference image size is invalid.");
  const filePath = path.join(directory, `reference-${crypto.randomUUID()}.png`);
  fs.writeFileSync(filePath, bytes);
  return filePath;
}

async function uploadReference(filePath) {
  const form = new FormData();
  form.append("image", new Blob([fs.readFileSync(filePath)], { type: "image/png" }), path.basename(filePath));
  form.append("overwrite", "true");
  const response = await fetch(`${baseUrl}/upload/image`, { method: "POST", body: form });
  if (!response.ok) throw new Error(`Reference upload failed (${response.status}).`);
  const payload = await response.json();
  if (!payload.name) throw new Error("ComfyUI returned no uploaded filename.");
  return String(payload.name);
}

function removeUploadedReference(uploadedName) {
  const inputRoot = path.resolve("C:\\AI-Apps\\ComfyUI_windows_portable\\ComfyUI\\input");
  const candidate = path.resolve(inputRoot, uploadedName);
  if (candidate.startsWith(`${inputRoot}${path.sep}`) && fs.existsSync(candidate)) {
    fs.rmSync(candidate, { force: true });
  }
}

async function generateOne(tag, query) {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "vela-reference-test-"));
  let uploadedName = "";
  try {
    let localReference;
    let lastError;
    for (const url of await searchReferences(query)) {
      try {
        localReference = await downloadReference(url, tempDirectory);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!localReference) throw lastError ?? new Error("No downloadable reference image.");
    uploadedName = await uploadReference(localReference);

    const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
    workflow["4"].inputs.ckpt_name = "animagine-xl-4.0-opt.safetensors";
    workflow["3"].inputs.steps = 10;
    workflow["3"].inputs.seed = Math.floor(Math.random() * 2147483647);
    workflow["5"].inputs.width = 512;
    workflow["5"].inputs.height = 768;
    workflow["6"].inputs.text = `masterpiece, best quality, Chinese webcomic anime illustration, clean lineart, anthropomorphic mythical beast character, ${query}, consistent character appearance based on the reference image, full body, expressive pose, detailed background, no text, no watermark`;
    workflow["7"].inputs.text = "lowres, blurry, bad anatomy, extra limbs, duplicate character, human anatomy, text, letters, logo, watermark, signature";
    workflow["9"].inputs.filename_prefix = `VELA-Reference-Test-${tag}`;
    workflow["12"].inputs.image = uploadedName;

    const queued = await fetch(`${baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: `vela-reference-test-${crypto.randomUUID()}` })
    });
    if (!queued.ok) throw new Error(`ComfyUI queue failed (${queued.status}).`);
    const { prompt_id: promptId } = await queued.json();
    for (let attempt = 0; attempt < 420; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const history = await fetch(`${baseUrl}/history/${encodeURIComponent(promptId)}`);
      if (!history.ok) continue;
      const record = (await history.json())[promptId];
      if (record?.status?.status_str === "error") throw new Error("ComfyUI generation failed.");
      const images = record?.outputs?.["9"]?.images;
      if (Array.isArray(images) && images.length) {
        console.log(JSON.stringify({ tag, images }));
        return;
      }
    }
    throw new Error(`Generation timed out for ${tag}.`);
  } finally {
    if (uploadedName) removeUploadedReference(uploadedName);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

for (const [tag, query] of tests) await generateOne(tag, query);
