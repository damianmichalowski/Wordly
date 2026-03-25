/**
 * Structured dev logging: timestamps, tags, and performance lines.
 * Avoid calling from render paths; use for lifecycle, I/O, cache, and user actions.
 */

function timestamp(): string {
  return new Date().toISOString();
}

function nowMs(): number {
  const p = globalThis.performance;
  if (p && typeof p.now === "function") {
    return p.now();
  }
  return Date.now();
}

/** Context tags for grep-friendly console output. */
export const LogTag = {
  WORD_FLOW: "WORD_FLOW",
  WORD_CACHE: "WORD_CACHE",
  VOCAB_CACHE: "VOCAB_CACHE",
  KNOWN_WORDS_CACHE: "KNOWN_WORDS_CACHE",
  USER_ACTION: "USER_ACTION",
  SUPABASE: "SUPABASE",
  REVISION: "REVISION",
  REVISION_HUB: "REVISION_HUB",
  REVISION_SESSION: "REVISION_SESSION",
  PERF: "PERF",
  CARD_FLOW: "CARD_FLOW",
  EXAMPLES: "EXAMPLES",
  ROLLOVER: "ROLLOVER",
} as const;

export type LogTagValue = (typeof LogTag)[keyof typeof LogTag];

function line(tag: string, message: string): string {
  return `${timestamp()} [${tag}] ${message}`;
}

export const logger = {
  info(tag: LogTagValue | string, message: string, ...args: unknown[]) {
    if (__DEV__) {
      console.log(line(String(tag), message), ...args);
    }
  },

  warn(tag: LogTagValue | string, message: string, ...args: unknown[]) {
    console.warn(line(String(tag), message), ...args);
  },

  error(tag: LogTagValue | string, message: string, ...args: unknown[]) {
    console.error(line(String(tag), message), ...args);
  },

  /**
   * High-signal duration line: `[PERF] cache-read: 3.2ms`
   * Use for cache, network segments, and total time-to-UI.
   */
  perf(metricName: string, durationMs: number, detail?: string) {
    const extra = detail ? ` ${detail}` : "";
    if (__DEV__) {
      console.log(
        `${timestamp()} [${LogTag.PERF}] ${metricName}: ${durationMs.toFixed(1)}ms${extra}`,
      );
    }
  },

  /** Returns an `end()` function that logs [PERF] for the elapsed time. */
  perfScope(metricName: string): () => void {
    const t0 = nowMs();
    return () => {
      logger.perf(metricName, nowMs() - t0);
    };
  },

  /** `console.group` in dev only; runs `fn` inside the group. */
  group(label: string, fn: () => void) {
    if (__DEV__) {
      console.group(label);
      try {
        fn();
      } finally {
        console.groupEnd();
      }
    } else {
      fn();
    }
  },

  async groupAsync(label: string, fn: () => Promise<void>): Promise<void> {
    if (__DEV__) {
      console.group(label);
      try {
        await fn();
      } finally {
        console.groupEnd();
      }
    } else {
      await fn();
    }
  },
};
