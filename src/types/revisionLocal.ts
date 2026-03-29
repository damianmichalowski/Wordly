import type { RevisionSessionConfig } from "@/src/types/revisionSession";
import type { VocabularyWord } from "@/src/types/words";

/**
 * Local-first revision: hub tile counts from the in-memory / cached known-words
 * bundle (no Supabase read on hub open). `daily` = capped Daily Review session
 * size; `recent` = Recently Learned (≤20); `all` = known pool size.
 */
export type RevisionHubModeStats = {
  daily: number;
  recent: number;
  all: number;
};

/** Stable snapshot when entering a hub-driven session (for logging / future resume). */
export type RevisionSessionSnapshot = {
  sessionId: string;
  config: RevisionSessionConfig;
  /** Sense ids in session order before shuffle (shuffle applied for flash deck). */
  cardSenseIds: string;
  createdAtMs: number;
};

/** Runtime card state kept only in React state today; shape documented for clarity. */
export type RevisionCardRuntimeState = {
  senseId: string;
  word: VocabularyWord;
  revealed: boolean;
};

export type RevisionCardProgress = {
  revealed: boolean;
  revealedAtMs?: number;
};
