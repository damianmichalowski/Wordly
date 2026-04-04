import type { RevisionSessionConfig } from "@/src/types/revisionSession";

/** Human-readable session length for the completion screen (e.g. `3m 12s`). */
export function formatSessionDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) {
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  }
  return `${s}s`;
}

export function getFlashSessionLabel(config: RevisionSessionConfig): string {
  switch (config.kind) {
    case "daily":
      return "Dziś";
    case "quick":
      return "Szybko";
    case "recent":
      return "Świeże";
    case "category":
      return "Kategoria";
    case "custom":
      return "Sesja";
  }
}
