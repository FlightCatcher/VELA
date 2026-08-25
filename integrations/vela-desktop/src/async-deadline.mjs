export async function runWithDeadline(operation, timeoutMs, fallback) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs must be a positive number.");
  }

  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      new Promise((resolve) => {
        timer = setTimeout(() => {
          controller.abort(new Error("Operation deadline exceeded."));
          resolve(fallback);
        }, timeoutMs);
        timer.unref?.();
      })
    ]);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
