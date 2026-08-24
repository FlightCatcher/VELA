const CHARACTER_PATTERN = /(角色|人物|少女|少年|女性|男性|女孩|男孩|兽人|拟人|动漫|二次元|同人|有兽焉|辟邪|天禄|洛天依|初音未来|character|girl|boy|woman|man|anime|manga|anthropomorphic|luo tianyi|hatsune miku)/i;
const KNOWN_IDENTITY_PATTERN = /(有兽焉|辟邪|天禄|洛天依|初音未来|官方角色|真实人物|明星|演员|名人|历史人物|specific character|official character|celebrity|luo tianyi|hatsune miku)/i;
const REAL_PLACE_PATTERN = /(陆家嘴|东京塔|济州岛|机场|酒店|景区|地标|真实地点|上海|北京|东京|首尔|纽约|巴黎|location|landmark|airport|hotel)/i;
const PHOTO_PATTERN = /(写实|真实|摄影|照片|手机实拍|抓拍|人像|野生动物|photoreal|realistic|photo|photography|smartphone|portrait|wildlife)/i;
const ANIME_PATTERN = /(动漫|二次元|国漫|有兽焉|插画|漫画|赛璐璐|拟人|兽人|anime|manga|illustration|cel shading|cartoon)/i;
const PRODUCT_PATTERN = /(产品|商品|包装|电商|棚拍|海报|logo|product|packaging|commercial)/i;
const LANDSCAPE_PATTERN = /(风景|山|海边|森林|城市|街道|建筑|天空|夜景|landscape|mountain|coast|forest|city|street|architecture)/i;

const KNOWN_CHARACTERS = [
  {
    id: "bixie",
    pattern: /(辟邪|bixie|pixiu)/i,
    prompt: "Bixie: round fluffy white beast, crimson markings and tail, lime eyes, bronze horn, calm expression"
  },
  {
    id: "tianlu",
    pattern: /(天禄|tianlu)/i,
    prompt: "Tianlu: round fluffy white beast, cyan markings and tail, golden-green eyes, golden horn, cheerful expression"
  },
  {
    id: "luo-tianyi",
    pattern: /(洛天依|luo tianyi)/i,
    prompt: "Luo Tianyi: teenage Chinese virtual singer, long aqua-blue hair with gray gradient tips, green eyes, signature blue-white futuristic outfit and diamond-shaped hair ornament"
  },
  {
    id: "hatsune-miku",
    pattern: /(初音未来|hatsune miku)/i,
    prompt: "Hatsune Miku: virtual singer with very long turquoise twin-tails, turquoise eyes, black-gray sleeveless outfit with teal accents and detached sleeves"
  }
];

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function boundedScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

function extractNumberField(value, field) {
  const match = String(value).match(new RegExp(`["']?${field}["']?\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, "i"));
  return match ? Number(match[1]) : null;
}

function extractStringField(value, field) {
  const match = String(value).match(new RegExp(`["']?${field}["']?\\s*:\\s*["']([\\s\\S]*?)["'](?=\\s*[,}\\n])`, "i"));
  return match ? clean(match[1]).slice(0, 300) : "";
}

function extractIssues(value) {
  const match = String(value).match(/["']?issues["']?\s*:\s*\[([\s\S]*?)]/i);
  if (!match) return [];
  return [...match[1].matchAll(/["']([^"']+)["']/g)]
    .map((item) => clean(item[1]).slice(0, 160))
    .filter(Boolean)
    .slice(0, 6);
}

/** Parse local vision output without letting minor JSON mistakes hide a generated image. */
export function parseVisualReviewResponse(rawValue) {
  const raw = String(rawValue ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\s*```(?:json)?|```\s*$/gim, "")
    .trim();
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  let parsed = null;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    const score = extractNumberField(candidate, "score");
    if (score == null) return null;
    parsed = {
      score,
      subjectMatch: extractNumberField(candidate, "subjectMatch"),
      compositionMatch: extractNumberField(candidate, "compositionMatch"),
      referenceMatch: extractNumberField(candidate, "referenceMatch"),
      issues: extractIssues(candidate),
      summary: extractStringField(candidate, "summary")
    };
  }
  return {
    score: boundedScore(parsed?.score),
    subjectMatch: boundedScore(parsed?.subjectMatch),
    compositionMatch: boundedScore(parsed?.compositionMatch),
    referenceMatch: boundedScore(parsed?.referenceMatch),
    issues: Array.isArray(parsed?.issues)
      ? parsed.issues.map((item) => clean(item).slice(0, 160)).filter(Boolean).slice(0, 6)
      : [],
    summary: clean(parsed?.summary).slice(0, 300)
  };
}

function includesAny(value, pattern) {
  return pattern.test(clean(value));
}

function inferIdentityLabel(prompt) {
  const value = clean(prompt);
  const franchiseCharacter = value.match(/[《「“"]([^》」”"]{2,40})[》」”"](?:中|里面)?的([\p{Script=Han}A-Za-z0-9·_-]{2,20}?)(?=在|于|和|与|，|,|\s|$)/u);
  const quoted = value.match(/[《「“"]([^》」”"]{2,40})[》」”"]/u);
  const named = value.match(/(?:生成|画|绘制|创作)(?:一张|一个|一幅)?\s*([\p{Script=Han}A-Za-z0-9·_-]{2,20})(?=在|于|和|与|的|，|,|\s)/u);
  const candidate = clean(franchiseCharacter?.[2] || quoted?.[1] || named?.[1]);
  if (!candidate || /(一个|一位|女孩|少女|人物|角色|动漫|二次元|女性|男性|兽人|真实|未来|城市|风景)/i.test(candidate)) return "";
  return candidate;
}

function explicitStyle(prompt, settings = {}) {
  const selected = clean(settings.style).toLowerCase();
  if (selected && selected !== "auto") return selected;
  if (includesAny(prompt, PHOTO_PATTERN)) return "photo";
  if (includesAny(prompt, ANIME_PATTERN)) return "anime";
  if (includesAny(prompt, PRODUCT_PATTERN)) return "product";
  if (/(电影|电影感|cinematic|film still)/i.test(prompt)) return "cinematic";
  return "auto";
}

function subjectType(prompt, identityLabel = "") {
  if (includesAny(prompt, PRODUCT_PATTERN)) return "product";
  if (identityLabel || includesAny(prompt, CHARACTER_PATTERN)) return "character";
  if (/(动物|鸟|猫|狗|狐狸|鲸|兽|animal|bird|cat|dog|fox|whale)/i.test(prompt)) return "animal";
  if (includesAny(prompt, REAL_PLACE_PATTERN)) return "place";
  if (includesAny(prompt, LANDSCAPE_PATTERN)) return "environment";
  return "general";
}

function inferCamera(prompt, type) {
  const value = clean(prompt);
  if (/(低机位|仰拍|street level|low angle)/i.test(value)) return "street-level low-angle camera";
  if (/(俯拍|鸟瞰|航拍|top.?down|aerial|drone)/i.test(value)) return "high-angle aerial camera";
  if (/(自拍|手机|抓拍|selfie|smartphone|snapshot)/i.test(value)) return "natural smartphone camera";
  if (/(长焦|telephoto)/i.test(value)) return "telephoto compression";
  if (/(广角|wide.?angle)/i.test(value)) return "wide-angle perspective";
  if (type === "character") return "eye-level medium shot";
  if (type === "product") return "clean three-quarter product view";
  return "natural eye-level view";
}

function inferComposition(prompt, type) {
  const value = clean(prompt);
  if (/(全身|full.?body)/i.test(value)) return "full body visible with clear silhouette";
  if (/(半身|half.?body|medium shot)/i.test(value)) return "medium framing";
  if (/(特写|close.?up)/i.test(value)) return "close-up framing";
  if (/(三分法|rule of thirds)/i.test(value)) return "rule-of-thirds composition";
  if (/(居中|centered|symmetr)/i.test(value)) return "centered balanced composition";
  if (type === "character") return "single clear subject, readable silhouette, uncluttered background separation";
  return "strong foreground, midground and background separation";
}

function inferLighting(prompt, style) {
  const value = clean(prompt);
  if (/(黄昏|日落|sunset|golden hour)/i.test(value)) return "warm sunset rim light with cool ambient shadows";
  if (/(夜景|霓虹|night|neon)/i.test(value)) return "night lighting with controlled practical lights and reflections";
  if (/(阴天|overcast)/i.test(value)) return "soft overcast daylight";
  if (/(逆光|backlight)/i.test(value)) return "controlled backlight and natural rim light";
  if (style === "photo") return "natural non-studio lighting and realistic exposure";
  return "coherent directional light with physically consistent shadows";
}

function inferPalette(prompt) {
  const value = clean(prompt);
  if (/(黑白|灰阶|单色|monochrome|grayscale|black and white)/i.test(value)) return "strict monochrome black, white and gray palette; no saturated colors";
  if (/(低饱和|muted|desaturated)/i.test(value)) return "muted low-saturation palette";
  if (/(高饱和|vivid|saturated)/i.test(value)) return "controlled vivid palette";
  return "coherent restrained palette";
}

function inferScale(prompt) {
  if (/(巨大化|巨人|巨大|giant|gigantic|colossal)/i.test(prompt)) {
    return "extreme scale contrast shown by tiny cars, people, streetlights and buildings; camera remains at human street height";
  }
  return "physically coherent scale relationships";
}

function inferReferenceMode(prompt, settings, attachments, type, identityLabel = "") {
  if (attachments > 0) return "user-image";
  if (clean(settings.reference).toLowerCase() === "off") return "none";
  if (identityLabel || includesAny(prompt, KNOWN_IDENTITY_PATTERN)) return "identity-search";
  if (type === "place") return "visual-research";
  return "none";
}

function chooseEngine(style, type, settings = {}, hasReference = false) {
  const requested = clean(settings.engine).toLowerCase();
  if (requested && requested !== "auto") {
    if (["anime", "ssd1b", "flux2", "realistic"].includes(requested)) return requested;
  }
  if (style === "photo" || style === "natural" || type === "animal") return "realistic";
  if (style === "anime" || style === "illustration" || type === "character") return hasReference ? "flux2" : "anime";
  return "ssd1b";
}

export function analyzeImageRequest(prompt, settings = {}, attachments = []) {
  const original = clean(prompt);
  if (!original) throw new Error("Image prompt is empty.");
  const identityLabel = inferIdentityLabel(original);
  const type = subjectType(original, identityLabel);
  const style = explicitStyle(original, settings);
  const attachmentCount = Array.isArray(attachments) ? attachments.filter((item) => item?.type === "image").length : 0;
  const referenceMode = inferReferenceMode(original, settings, attachmentCount, type, identityLabel);
  const needsReference = referenceMode !== "none";
  const knownCharacters = KNOWN_CHARACTERS.filter((character) => character.pattern.test(original));
  return {
    version: 1,
    original,
    identityLabel,
    subjectType: type,
    subject: original,
    scene: includesAny(original, LANDSCAPE_PATTERN) || type === "place" ? original : "supporting environment consistent with the request",
    action: /(站|坐|跑|飞|拥抱|行走|奔跑|standing|sitting|running|flying|walking)/i.test(original) ? original : "natural pose or stable placement",
    camera: inferCamera(original, type),
    composition: inferComposition(original, type),
    lighting: inferLighting(original, style),
    palette: inferPalette(original),
    scale: inferScale(original),
    style,
    aspect: clean(settings.aspect) || "landscape",
    referenceMode,
    needsReference,
    engine: chooseEngine(style, type, settings, needsReference),
    knownCharacters,
    expectedSubjectCount: knownCharacters.length || (/两只|两个|二人|pair|two /i.test(original) ? 2 : 1),
    constraints: [
      "preserve requested subject count, identity, colors, action and setting",
      "no unrelated characters or objects",
      "no text, watermark, logo, collage or character sheet unless explicitly requested"
    ]
  };
}

export function buildReferenceQueries(spec) {
  const subject = clean(spec?.identityLabel || spec?.original).slice(0, 180);
  if (!subject) return [];
  if (spec.referenceMode === "visual-research") {
    return [
      `"${subject}" real location architecture photo`,
      `${subject} landmark street view official`,
      `${subject} 建筑 地标 实景 官方`
    ];
  }
  return [
    `"${subject}" official character reference`,
    `${subject} 官方 角色设定 立绘`,
    `${subject} character model sheet official art`,
    `${subject} official full body key visual`
  ];
}

export function selectReferenceCandidate(candidates, options = {}) {
  const verifiedScore = Math.max(0, Math.min(100, Number(options.verifiedScore) || 68));
  const fallbackScore = Math.max(0, Math.min(verifiedScore, Number(options.fallbackScore) || 48));
  const sorted = (Array.isArray(candidates) ? candidates : [])
    .filter((item) => item?.path && Number.isFinite(Number(item?.score)))
    .sort((left, right) => Number(right.score) - Number(left.score));
  const best = sorted[0] ?? null;
  if (!best || Number(best.score) < fallbackScore) return null;
  return {
    ...best,
    confidence: Number(best.score) >= verifiedScore ? "verified" : "weak"
  };
}

export function imageJobIsStale(job, options = {}) {
  if (!job) return false;
  if (job.cancelled) return true;
  const now = Number(options.now ?? Date.now());
  const maxAgeMs = Math.max(1000, Number(options.maxAgeMs ?? 30 * 60 * 1000));
  const startedAt = Number(job.startedAt);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return true;
  return Number.isFinite(now) && now - startedAt > maxAgeMs;
}

export function compileImagePrompt(spec, translatedPrompt = "", visualSpec = "", referenceLocked = false) {
  const styleLanguage = spec.style === "photo" || spec.style === "natural"
    ? "realistic smartphone or professional photography as requested, natural exposure, plausible materials, subtle imperfections"
    : spec.style === "anime" || spec.style === "illustration"
      ? "polished anime illustration, clean intentional linework, controlled cel shading, accurate character design"
      : spec.style === "product"
        ? "premium minimal product photography, clean material rendering, restrained commercial styling"
        : "coherent cinematic visual design with restrained detail";
  const request = clean(translatedPrompt)
    .replace(/[*#`]/g, "")
    .replace(/\b(a precise english diffusion prompt|request|prompt)\s*:\s*/gi, "")
    .replace(/^['"]|['"]$/g, "") || spec.original;
  const identity = clean(visualSpec)
    .replace(/[*#`]/g, "")
    .replace(/\b(species|silhouette|face shape|eye colors?|gradient|horns?|ears?|fur|hair|markings?|tail|costume|line style|distinctive asymmetry)\s*:\s*/gi, "")
    .slice(0, 150);
  const knownIdentity = Array.isArray(spec.knownCharacters)
    ? spec.knownCharacters.map((character) => character.prompt).join("; ")
    : "";
  if (referenceLocked && Array.isArray(spec.knownCharacters) && spec.knownCharacters.length > 1) {
    return [
      "Exactly two distinct full-body characters in one continuous scene.",
      request,
      "Bixie on the left: fluffy white, crimson markings and tail, lime eyes, bronze horn.",
      "Tianlu on the right: fluffy white, cyan markings and tail, golden-green eyes, golden horn.",
      spec.lighting,
      "clean official-style anime linework.",
      "No third subject, panel, frame, collage, crop, duplicate, or merged identity."
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  const groupDirection = Number(spec.expectedSubjectCount) > 1
    ? `Exactly ${spec.expectedSubjectCount} distinct subjects, side by side, both fully visible.`
    : "";
  const parts = referenceLocked ? [
    groupDirection,
    knownIdentity || identity,
    "Match the references' identity, silhouette, colors, markings and line style.",
    request,
    spec.composition,
    spec.lighting,
    styleLanguage
  ] : [
    request,
    groupDirection,
    spec.camera,
    spec.composition,
    spec.lighting,
    spec.palette,
    spec.scale,
    styleLanguage
  ];
  const compiled = parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const words = compiled.split(" ");
  return words.length > 48 ? `${words.slice(0, 48).join(" ").replace(/[,:;.]?$/, "")}.` : compiled;
}

export function compileNegativePrompt(spec, settings = {}) {
  const values = [
    "low quality, blurry, malformed anatomy, duplicate subject, extra limbs, cropped subject, incoherent perspective, inconsistent shadows",
    settings.textMode === "clear" ? "garbled text, misspelled text" : "text, watermark, signature, logo",
    spec.style === "photo" || spec.style === "natural" ? "anime, cartoon, plastic skin, CGI, excessive HDR, studio glamour retouching" : "photorealistic skin pasted onto illustration",
    /monochrome/i.test(spec.palette) ? "saturated color, rainbow palette, neon color accents" : "",
    spec.subjectType === "character" ? "character sheet, collage, multiple views, identity drift, changed markings, generic redesign" : ""
  ];
  return values.filter(Boolean).join(", ");
}

export function configureMultiReferenceIpAdapter(workflow, uploadedNames, options = {}) {
  const names = Array.isArray(uploadedNames) ? uploadedNames.filter(Boolean).slice(0, 2) : [];
  if (names.length < 2) throw new Error("Two uploaded references are required.");
  if (!workflow?.["3"]?.inputs || !workflow?.["10"]?.inputs || !workflow?.["11"]?.inputs || !workflow?.["12"]?.inputs) {
    throw new Error("The reference workflow is missing required IP-Adapter nodes.");
  }

  const weight = Math.max(0.35, Math.min(0.8, Number(options.weight) || 0.58));
  const endAt = Math.max(0.5, Math.min(1, Number(options.endAt) || 0.82));
  const width = Math.max(64, Math.round(Number(options.width) || 768));
  const height = Math.max(64, Math.round(Number(options.height) || 432));
  const regionWidth = Math.round(width * 0.48);
  const rightOffset = width - regionWidth;
  const regionalPrompts = Array.isArray(options.regionalPrompts) ? options.regionalPrompts : [];
  const leftPrompt = clean(regionalPrompts[0]) || "Bixie on the left, full body, fluffy white beast, crimson markings and tail, lime eyes, bronze horn, in one continuous bamboo forest scene";
  const rightPrompt = clean(regionalPrompts[1]) || "Tianlu on the right, full body, fluffy white beast, cyan markings and tail, golden-green eyes, golden horn, in one continuous bamboo forest scene";
  workflow["12"].inputs.image = names[0];
  workflow["13"] = {
    inputs: { image: names[1] },
    class_type: "LoadImage"
  };
  workflow["15"] = {
    inputs: { value: 0, width, height },
    class_type: "SolidMask"
  };
  workflow["16"] = {
    inputs: { value: 1, width: regionWidth, height },
    class_type: "SolidMask"
  };
  workflow["17"] = {
    inputs: { destination: ["15", 0], source: ["16", 0], x: 0, y: 0, operation: "add" },
    class_type: "MaskComposite"
  };
  workflow["18"] = {
    inputs: { destination: ["15", 0], source: ["16", 0], x: rightOffset, y: 0, operation: "add" },
    class_type: "MaskComposite"
  };
  workflow["19"] = {
    inputs: { text: leftPrompt, clip: ["4", 1] },
    class_type: "CLIPTextEncode"
  };
  workflow["20"] = {
    inputs: { text: rightPrompt, clip: ["4", 1] },
    class_type: "CLIPTextEncode"
  };
  workflow["21"] = {
    inputs: {
      image: ["12", 0],
      image_weight: weight,
      prompt_weight: 1,
      weight_type: "linear",
      start_at: 0,
      end_at: endAt,
      mask: ["17", 0],
      positive: ["19", 0],
      negative: ["7", 0]
    },
    class_type: "IPAdapterRegionalConditioning"
  };
  workflow["22"] = {
    inputs: {
      image: ["13", 0],
      image_weight: weight,
      prompt_weight: 1,
      weight_type: "linear",
      start_at: 0,
      end_at: endAt,
      mask: ["18", 0],
      positive: ["20", 0],
      negative: ["7", 0]
    },
    class_type: "IPAdapterRegionalConditioning"
  };
  workflow["23"] = {
    inputs: { params_1: ["21", 0], params_2: ["22", 0] },
    class_type: "IPAdapterCombineParams"
  };
  workflow["24"] = {
    inputs: {
      model: ["11", 0],
      ipadapter: ["11", 1],
      ipadapter_params: ["23", 0],
      combine_embeds: "concat",
      embeds_scaling: "V only"
    },
    class_type: "IPAdapterFromParams"
  };
  workflow["25"] = {
    inputs: { conditioning_1: ["21", 1], conditioning_2: ["22", 1] },
    class_type: "ConditioningCombine"
  };
  workflow["26"] = {
    inputs: { conditioning_1: ["21", 2], conditioning_2: ["22", 2] },
    class_type: "ConditioningCombine"
  };
  delete workflow["10"];
  workflow["3"].inputs.model = ["24", 0];
  workflow["3"].inputs.positive = ["25", 0];
  workflow["3"].inputs.negative = ["26", 0];
  return workflow;
}

export function publicWorkflowSummary(spec) {
  return {
    subjectType: spec.subjectType,
    identityLabel: spec.identityLabel || null,
    style: spec.style,
    aspect: spec.aspect,
    engine: spec.engine,
    needsReference: spec.needsReference,
    referenceMode: spec.referenceMode,
    camera: spec.camera,
    lighting: spec.lighting,
    palette: spec.palette
  };
}
