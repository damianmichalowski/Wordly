import type { CefrLevel } from "@/src/types/cefr";
import type { RevisionSessionConfig } from "@/src/types/revisionSession";
import type { VocabularyWord } from "@/src/types/words";

/**
 * Local-first revision: counts for hub tiles, derived only from the in-memory /
 * cached known-words bundle (no live Supabase read on hub open).
 */
export type RevisionHubModeStats = {
  daily: number;
  difficult: number;
  recent: number;
  all: number;
  levelPreview: number;
  levelCounts: Record<CefrLevel, number>;
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
