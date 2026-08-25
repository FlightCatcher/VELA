export function isMissingSessionError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /session not found/i.test(message);
}
