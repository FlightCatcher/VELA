const NEGATED_IMAGE_REQUEST = /(?:不要|无需|别|禁止)\s*(?:生成|画|绘制|制作|创建).{0,8}(?:图|图片|图像|插画|照片)/i;

const IMAGE_REQUEST_PATTERNS = [
  // A Chinese image request often uses the classifier itself as the visual
  // noun ("生成一张……"). Requiring a later 图/图片 token incorrectly routed
  // requests such as "生成一张天禄和辟邪合照" into the chat agent.
  /^(?:请|麻烦|帮我|给我|我要|我想要|可以)?\s*(?:生成|画|绘制|制作|创建|做)\s*(?:一张|一幅|一个|几张|[1-9]\d*张)\s*[^。！？\n]{1,160}$/i,
  /^(?:请|麻烦|帮我|给我|我要|我想要|可以)?\s*(?:生成|画|绘制|制作|创建|做)\s*(?:一张|一幅|一个|几张|[1-9]\d*张)?[^。！？\n]{0,80}(?:图|图片|图像|插画|海报|壁纸|头像|照片)/i,
  /(?:帮我|给我|请)\s*(?:生成|画|绘制|制作|创建)[^。！？\n]{0,80}(?:图|图片|图像|插画|海报|壁纸|头像|照片)/i,
  /^(?:please\s+)?(?:generate|create|draw|render|make)\b[^.!?\n]{0,100}\b(?:image|picture|illustration|poster|wallpaper|portrait|photo)\b/i
];

const VISUAL_OUTPUT_NOUN = /(?:合照|合影|立绘|设定图|角色图|场景图|壁纸|头像|插画|海报|图片|图像|画面|photo|portrait|illustration|wallpaper|image)/i;
const KNOWN_VISUAL_IDENTITY = /(?:《[^》]{1,40}》|有兽焉|辟邪|天禄|四不相|洛天依|bixie|tianlu|fabulous beasts)/i;
const QUESTION_OR_ANALYSIS = /(?:是谁|是什么|为什么|怎么|如何|介绍|分析|解释|资料|设定是什么|who is|what is|explain|analy[sz]e)/i;

export function looksLikeImageGenerationRequest(value) {
  const text = String(value ?? "").trim();
  if (!text || NEGATED_IMAGE_REQUEST.test(text)) return false;
  if (IMAGE_REQUEST_PATTERNS.some((pattern) => pattern.test(text))) return true;
  if (QUESTION_OR_ANALYSIS.test(text)) return false;
  if (VISUAL_OUTPUT_NOUN.test(text) && KNOWN_VISUAL_IDENTITY.test(text)) return true;
  return text.length <= 28 && KNOWN_VISUAL_IDENTITY.test(text);
}

export function messageExecutionRoute(value, { imageMode = false } = {}) {
  return imageMode || looksLikeImageGenerationRequest(value) ? "local-image" : "agent";
}

const IDENTITY_LOCK_PATTERNS = [
  /(?:《[^》]{1,40}》|有兽焉|辟邪|天禄|四不相|洛天依|bixie|tianlu|fabulous beasts)/i,
  /(?:官方|原作|原版|设定图|角色卡|角色形象|还原|像参考图|identity|character reference|official character)/i,
  /(?:生成|画|绘制|制作|创建).{0,50}(?:中的|里的|from)\s*[^。！？\n]{1,40}(?:角色|character)?/i
];

export function needsVerifiedIdentityPipeline(value) {
  const text = String(value ?? "").trim();
  return Boolean(text) && IDENTITY_LOCK_PATTERNS.some((pattern) => pattern.test(text));
}
