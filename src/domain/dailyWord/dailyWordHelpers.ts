import { getEffectiveNow } from "@/src/time/appClock";
import type { UserWordProgress } from "@/src/types/progress";
import type { VocabularyWord } from "@/src/types/words";

export function progressKnownNow(
  wordId: string,
  existing: UserWordProgress | undefined,
  nowIso: string,
): UserWordProgress {
  return {
    wordId,
    status: "known",
    firstSeenAt: existing?.firstSeenAt ?? nowIso,
    markedKnownAt: nowIso,
    skippedAt: existing?.skippedAt,
    reviewCount: existing?.reviewCount ?? 0,
    lastReviewedAt: existing?.lastReviewedAt,
    nextReviewAt: existing?.nextReviewAt,
  };
}

/** Optimistic progress for home “I know” and rollover auto-known. */
export function buildOptimisticKnownUserProgress(
  wordId: string,
  existing: UserWordProgress | undefined,
): UserWordProgress {
  return progressKnownNow(wordId, existing, getEffectiveNow().toISOString());
}

export function selectNextWord(
  candidates: VocabularyWord[],
  progressByWordId: Record<string, UserWordProgress>,
): VocabularyWord | null {
  return (
    candidates.find((word) => {
      const status = progressByWordId[word.id]?.status;
      return status !== "known";
    }) ?? null
  );
}
