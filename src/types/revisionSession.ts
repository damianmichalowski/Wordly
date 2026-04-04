import type { CompleteDailyReviewSessionResult } from "@/src/features/achievements/types/achievementEvents.types";

/** Passed from in-memory session state to the completion screen (no Supabase). */
export type RevisionSessionCompletionStats = {
  cardsReviewed: number;
  sessionDurationMs: number;
  mode: string;
  /** Present when the hub session was daily review; includes streak + pending celebration events. */
  dailyReviewCompletion?: CompleteDailyReviewSessionResult;
};

/**
 * Aktywna sesja powtórki (wybór z huba).
 * `category` i `custom` na później (UI może być „wkrótce”).
 */
export type RevisionSessionConfig =
  | { kind: "daily" }
  | { kind: "quick"; count: 5 | 10 | 20 }
  | { kind: "recent" }
  | { kind: "category" }
  | { kind: "custom" };

/** `library`: dotychczasowa biblioteka; `hub`: centrum trybów; `session`: wybrany tryb. */
export type RevisionSessionPhase = "library" | "hub" | "session";

/** UI mode inside an active revision session (flashcards vs list placeholder). */
export type RevisionMode = "list" | "flashcards";

/** Compact string for analytics / completion UI; extend when adding session kinds. */
export function encodeRevisionSessionMode(config: RevisionSessionConfig): string {
  switch (config.kind) {
    case "quick":
      return `quick:${config.count}`;
    default:
      return config.kind;
  }
}
