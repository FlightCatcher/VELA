export function messageListRenderKey({ language, pending, activeImageRun, sessionKey, messages }) {
  return JSON.stringify({
    language,
    pendingKind: pending ? (activeImageRun ? "image" : "chat") : "none",
    sessionKey,
    messages
  });
}

export function clampImageProgress(value) {
  return Math.max(1, Math.min(99, Math.round(Number(value) || 1)));
}

const IMAGE_PHASE_RANGES = {
  "analyzing-request": [2, 8, 5],
  "compiling-spec": [8, 20, 15],
  "reference-search": [20, 30, 25],
  "reference-validation": [30, 36, 12],
  "reference-vision": [36, 42, 18],
  "prompt-compilation": [42, 48, 8],
  "starting-compatible-engine": [48, 54, 20],
  "loading-model": [48, 62, 90],
  generating: [62, 90, 150],
  "retrying-quality": [66, 90, 150],
  "validating-output": [90, 96, 30],
  upscaling: [92, 97, 90],
  "finalizing-output": [97, 98, 8]
};

export function estimateImageProgress({ phase, phaseElapsedSeconds = 0, previous = 1 } = {}) {
  const [start, end, expectedSeconds] = IMAGE_PHASE_RANGES[phase] ?? [2, 88, 180];
  const elapsed = Math.max(0, Number(phaseElapsedSeconds) || 0);
  const fraction = 1 - Math.exp(-elapsed / Math.max(1, expectedSeconds / 3));
  const estimated = start + (end - start) * Math.min(0.96, fraction);
  return clampImageProgress(Math.max(Number(previous) || 1, estimated));
}
