import type { CompleteDailyReviewSessionResult } from "@/src/features/achievements/types/achievementEvents.types";

export type RevisionSessionAnswerStats = {
  reviewed: number;
  knowCount: number;
  dontKnowCount: number;
};

/** Passed from in-memory session state to the completion screen (no Supabase). */
export type RevisionSessionCompletionStats = {
  cardsReviewed: number;
  sessionDurationMs: number;
  mode: string;
  endedEarly?: boolean;
  answerStats?: RevisionSessionAnswerStats;
  /** Present when the hub session was daily review; includes streak + pending celebration events. */
  dailyReviewCompletion?: CompleteDailyReviewSessionResult;
  difficultWordsCompletion?: {
    reviewed: number;
    mastered: number;
    stillDifficult: number;
  };
};

export type CompleteRevisionSessionOptions = {
  endedEarly?: boolean;
};

/**
 * Aktywna sesja powtórki (wybór z huba).
 * `category` i `custom` na później (UI może być „wkrótce”).
 */
export type RevisionSessionConfig =
  | { kind: "daily" }
  | { kind: "quick"; count: 5 | 10 | 20 }
  /** Session length; UI offers 5 / 10 / 20 when the pool has at least 5 words. */
  | { kind: "recent"; count: number }
  | { kind: "difficultWords"; limit: number }
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
    case "recent":
      return `recent:${config.count}`;
    case "difficultWords":
      return `difficultWords:${config.limit}`;
    default:
      return config.kind;
  }
}
