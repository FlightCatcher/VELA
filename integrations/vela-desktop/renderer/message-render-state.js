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
