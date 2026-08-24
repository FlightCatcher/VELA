import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeImageRequest,
  buildReferenceQueries,
  compileImagePrompt,
  compileNegativePrompt,
  configureMultiReferenceIpAdapter,
  parseVisualReviewResponse,
  publicWorkflowSummary,
  selectReferenceCandidate,
  imageJobIsStale
} from "../src/image-workflow.mjs";

test("routes anime characters to the anime engine", () => {
  const spec = analyzeImageRequest("生成一个二次元少女站在雨后街道", { engine: "auto" });
  assert.equal(spec.subjectType, "character");
  assert.equal(spec.engine, "anime");
});

test("legacy image jobs without a lease are stale", () => {
  assert.equal(imageJobIsStale({ phase: "loading-model", cancelled: false }), true);
});

test("fresh image jobs retain their lease", () => {
  assert.equal(
    imageJobIsStale(
      { phase: "generating", cancelled: false, startedAt: 1000 },
      { now: 2000, maxAgeMs: 5000 }
    ),
    false
  );
});

test("expired or cancelled image jobs are stale", () => {
  assert.equal(
    imageJobIsStale(
      { phase: "loading-model", cancelled: false, startedAt: 1000 },
      { now: 7001, maxAgeMs: 5000 }
    ),
    true
  );
  assert.equal(imageJobIsStale({ cancelled: true, startedAt: Date.now() }), true);
});

test("routes realistic portraits to the realistic engine", () => {
  const spec = analyzeImageRequest("真实手机抓拍女性海边人像", { engine: "auto" });
  assert.equal(spec.style, "photo");
  assert.equal(spec.engine, "realistic");
});

test("routes generic city concept art to SSD1B", () => {
  const spec = analyzeImageRequest("黑白未来城市概念图", { engine: "auto" });
  assert.equal(spec.engine, "ssd1b");
  assert.match(spec.palette, /monochrome/);
});

test("known identities require identity reference search", () => {
  const spec = analyzeImageRequest("生成《有兽焉》辟邪的图片", { engine: "auto" });
  assert.equal(spec.referenceMode, "identity-search");
  assert.equal(spec.needsReference, true);
  assert.equal(spec.engine, "flux2");
});

test("named anime characters route to identity-aware anime generation", () => {
  const spec = analyzeImageRequest("生成洛天依在咖啡厅中喝咖啡的图", { engine: "auto" });
  assert.equal(spec.subjectType, "character");
  assert.equal(spec.referenceMode, "identity-search");
  assert.equal(spec.engine, "flux2");
  assert.equal(spec.knownCharacters[0].id, "luo-tianyi");
});

test("unfamiliar named characters trigger identity reference search", () => {
  const spec = analyzeImageRequest("生成阿波罗在月光森林里散步", { engine: "auto" });
  assert.equal(spec.subjectType, "character");
  assert.equal(spec.identityLabel, "阿波罗");
  assert.equal(spec.referenceMode, "identity-search");
  assert.match(buildReferenceQueries(spec)[0], /阿波罗/);
});

test("franchise prompts extract the character rather than the title", () => {
  const spec = analyzeImageRequest("生成《原神》中的纳西妲在森林里散步", { engine: "auto" });
  assert.equal(spec.identityLabel, "纳西妲");
  assert.match(buildReferenceQueries(spec)[0], /纳西妲/);
  assert.doesNotMatch(buildReferenceQueries(spec)[0], /原神/);
});

test("reference selection prefers verified candidates and rejects unrelated images", () => {
  const selected = selectReferenceCandidate([
    { path: "weak.jpg", score: 52 },
    { path: "official.jpg", score: 86 },
    { path: "unrelated.jpg", score: 12 }
  ]);
  assert.equal(selected.path, "official.jpg");
  assert.equal(selected.confidence, "verified");
  assert.equal(selectReferenceCandidate([{ path: "bad.jpg", score: 20 }]), null);
});

test("real locations use visual research rather than identity locking", () => {
  const spec = analyzeImageRequest("陆家嘴雨后街道夜景", { engine: "auto" });
  assert.equal(spec.referenceMode, "visual-research");
  assert.equal(spec.engine, "ssd1b");
});

test("user reference switches character work to reference editing", () => {
  const spec = analyzeImageRequest("把角色改成冬季服装", { engine: "auto" }, [{ type: "image" }]);
  assert.equal(spec.referenceMode, "user-image");
  assert.equal(spec.engine, "flux2");
});

test("explicit engine selection is respected", () => {
  const spec = analyzeImageRequest("未来城市", { engine: "realistic" });
  assert.equal(spec.engine, "realistic");
});

test("giant scenes compile concrete scale references", () => {
  const spec = analyzeImageRequest("巨大化动漫角色站在城市，街道低角度仰拍", { engine: "auto" });
  const prompt = compileImagePrompt(spec);
  assert.match(prompt, /tiny cars, people, streetlights and buildings/);
  assert.match(prompt, /street-level low-angle camera/);
});

test("reference queries differ for locations and characters", () => {
  const location = analyzeImageRequest("东京塔夜景", { engine: "auto" });
  const character = analyzeImageRequest("有兽焉天禄", { engine: "auto" });
  assert.match(buildReferenceQueries(location)[0], /architecture photo/);
  assert.match(buildReferenceQueries(character)[0], /official character reference/);
});

test("public workflow summary excludes raw internal detail", () => {
  const summary = publicWorkflowSummary(analyzeImageRequest("黑白未来城市", { engine: "auto" }));
  assert.deepEqual(Object.keys(summary), ["subjectType", "identityLabel", "style", "aspect", "engine", "needsReference", "referenceMode", "camera", "lighting", "palette"]);
});

test("negative prompt enforces monochrome requests", () => {
  const spec = analyzeImageRequest("黑白未来城市", { engine: "auto" });
  assert.match(compileNegativePrompt(spec), /saturated color/);
});

test("compiled prompts stay within the CLIP token budget approximation", () => {
  const spec = analyzeImageRequest("巨大化动漫角色站在现代城市，雨后街道低机位仰拍，黄昏电影光", { engine: "auto" });
  const prompt = compileImagePrompt(spec, "A gigantic anime character standing in a modern city after rain at sunset", "white fur, red markings, green eyes, bronze horns", true);
  assert.ok(prompt.split(" ").length <= 48);
  assert.match(prompt, /white fur/);
});

test("known multi-character requests preserve both identities and subject count", () => {
  const spec = analyzeImageRequest("有兽焉天禄和辟邪合照", { engine: "auto" });
  const prompt = compileImagePrompt(spec, "friendly group portrait", "", true);
  assert.equal(spec.expectedSubjectCount, 2);
  assert.match(prompt, /Tianlu/);
  assert.match(prompt, /Bixie/);
  assert.match(prompt, /Exactly two distinct full-body characters/);
  assert.doesNotMatch(prompt, /dragon|winged lion/i);
  assert.ok(prompt.split(" ").length <= 64);
  assert.match(prompt, /friendly group portrait/);
});

test("verbose vision prose cannot displace the requested subject", () => {
  const spec = analyzeImageRequest("生成有兽焉辟邪", { engine: "auto" });
  const prompt = compileImagePrompt(
    spec,
    "clean character portrait",
    "**Species:** mythical creature **Silhouette:** round and fluffy. A precise English diffusion prompt based on the request is a generic dragon in armor.",
    true
  );
  assert.match(prompt, /^Bixie/);
  assert.doesNotMatch(prompt, /generic dragon|armor/i);
});

test("multi-character references use regional conditioning instead of a collage", () => {
  const workflow = {
    "3": { inputs: { model: ["10", 0] } },
    "10": { inputs: { weight: 1, end_at: 1, weight_type: "standard" } },
    "11": { inputs: { preset: "PLUS (high strength)" } },
    "12": { inputs: { image: "old-sheet.png" } }
  };
  configureMultiReferenceIpAdapter(workflow, ["bixie.png", "tianlu.png"], {
    width: 768,
    height: 432,
    regionalPrompts: ["Bixie left in bamboo", "Tianlu right in bamboo"]
  });
  assert.equal(workflow["12"].inputs.image, "bixie.png");
  assert.equal(workflow["13"].inputs.image, "tianlu.png");
  assert.deepEqual(workflow["3"].inputs.model, ["24", 0]);
  assert.deepEqual(workflow["3"].inputs.positive, ["25", 0]);
  assert.deepEqual(workflow["3"].inputs.negative, ["26", 0]);
  assert.equal(workflow["21"].class_type, "IPAdapterRegionalConditioning");
  assert.equal(workflow["22"].class_type, "IPAdapterRegionalConditioning");
  assert.equal(workflow["23"].class_type, "IPAdapterCombineParams");
  assert.equal(workflow["24"].class_type, "IPAdapterFromParams");
  assert.deepEqual(workflow["21"].inputs.mask, ["17", 0]);
  assert.deepEqual(workflow["22"].inputs.mask, ["18", 0]);
  assert.equal(workflow["19"].inputs.text, "Bixie left in bamboo");
  assert.equal(workflow["20"].inputs.text, "Tianlu right in bamboo");
  assert.equal(workflow["16"].inputs.width, 369);
  assert.equal(workflow["18"].inputs.x, 399);
  assert.ok(workflow["21"].inputs.image_weight < 0.8);
  assert.equal(workflow["10"], undefined);
});

test("visual review parser accepts valid JSON", () => {
  assert.deepEqual(parseVisualReviewResponse('{"score":84,"subjectMatch":90,"compositionMatch":80,"referenceMatch":75,"issues":[],"summary":"acceptable"}'), {
    score: 84,
    subjectMatch: 90,
    compositionMatch: 80,
    referenceMatch: 75,
    issues: [],
    summary: "acceptable"
  });
});

test("visual review parser recovers useful fields from malformed JSON", () => {
  const parsed = parseVisualReviewResponse(`{
    "score": 18,
    "subjectMatch": 4
    "compositionMatch": 20,
    "referenceMatch": 0,
    "issues": ["no requested character", "abstract color blocks"],
    "summary": "The result does not match the request."
  }`);
  assert.equal(parsed.score, 18);
  assert.equal(parsed.subjectMatch, 4);
  assert.deepEqual(parsed.issues, ["no requested character", "abstract color blocks"]);
  assert.equal(parsed.summary, "The result does not match the request.");
});

test("visual review parser rejects prose without a score", () => {
  assert.equal(parseVisualReviewResponse("I cannot inspect the image."), null);
});
