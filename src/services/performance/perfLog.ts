/**
 * Back-compat timing helpers; prefer `logger.perf` / `logger.perfScope` from `@/src/utils/logger`.
 */
import { logger } from "@/src/utils/logger";

const timers = new Map<string, number>();

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

export const perfLog = {
  start(label: string) {
    timers.set(label, nowMs());
  },
  end(label: string) {
    const t0 = timers.get(label);
    if (t0 === undefined) {
      return;
    }
    timers.delete(label);
    logger.perf(label, nowMs() - t0);
  },
  async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      return await fn();
    } finally {
      this.end(label);
    }
  },
};
