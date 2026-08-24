export class RunCoordinator {
  constructor() {
    this.generation = 0;
    this.active = null;
  }

  start({ kind = "chat", requestId, controller = null } = {}) {
    this.generation += 1;
    this.active = {
      generation: this.generation,
      kind,
      requestId: requestId || crypto.randomUUID(),
      serverRunId: null,
      controller,
      cancelled: false
    };
    return { ...this.active };
  }

  isCurrent(run) {
    return Boolean(
      run
      && this.active
      && !this.active.cancelled
      && run.generation === this.active.generation
    );
  }

  attachServerRunId(run, serverRunId) {
    if (!run || run.generation !== this.active?.generation) return false;
    this.active.serverRunId = serverRunId || null;
    return !this.active.cancelled;
  }

  cancel() {
    if (!this.active) return null;
    this.active.cancelled = true;
    this.active.controller?.abort?.();
    this.generation += 1;
    return { ...this.active };
  }

  finish(run) {
    if (!this.isCurrent(run)) return false;
    this.active = null;
    return true;
  }
}
