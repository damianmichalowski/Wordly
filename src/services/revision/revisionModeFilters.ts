import type { RevisionSessionConfig } from "@/src/types/revisionSession";
import type { UserWordProgress } from "@/src/types/progress";
import type { VocabularyWord } from "@/src/types/words";

import type { RevisionSortPrefs } from "@/src/services/revision/revisionSortPrefs";
import { sortKnownWordsForRevision } from "@/src/services/revision/revisionSort";
import { isDueForReview } from "@/src/services/revision/spacedRepetition";
import { LogTag, logger } from "@/src/utils/logger";
import { shuffleArray } from "@/src/utils/shuffleArray";

export type RevisionWordBundle = {
  words: VocabularyWord[];
  progressByWordId: Record<string, UserWordProgress>;
};

/** Hard cap for Daily Review — never a huge session. */
export const DAILY_REVIEW_MAX_WORDS = 20;

/** Recently Learned uses newest known words only, capped. */
export const RECENTLY_LEARNED_MAX_WORDS = 20;

function sortByMostUrgentDue(
  words: VocabularyWord[],
  progressByWordId: Record<string, UserWordProgress>,
): VocabularyWord[] {
  return [...words].sort((a, b) => {
    const na = progressByWordId[a.id]?.nextReviewAt ?? "";
    const nb = progressByWordId[b.id]?.nextReviewAt ?? "";
    if (na === nb) {
      return a.id.localeCompare(b.id);
    }
    if (!na) {
      return -1;
    }
    if (!nb) {
      return 1;
    }
    return na.localeCompare(nb);
  });
}

/** Non-due words: soonest upcoming review first (next in queue). */
function sortBySoonestUpcomingReview(
  words: VocabularyWord[],
  progressByWordId: Record<string, UserWordProgress>,
): VocabularyWord[] {
  return [...words].sort((a, b) => {
    const na = progressByWordId[a.id]?.nextReviewAt ?? "";
    const nb = progressByWordId[b.id]?.nextReviewAt ?? "";
    if (na === nb) {
      return a.id.localeCompare(b.id);
    }
    if (!na) {
      return 1;
    }
    if (!nb) {
      return -1;
    }
    return na.localeCompare(nb);
  });
}

function sortByNewestLearned(
  words: VocabularyWord[],
  progressByWordId: Record<string, UserWordProgress>,
): VocabularyWord[] {
  return [...words].sort((a, b) => {
    const pa = progressByWordId[a.id];
    const pb = progressByWordId[b.id];
    const ta = pa?.markedKnownAt ?? pa?.firstSeenAt ?? "";
    const tb = pb?.markedKnownAt ?? pb?.firstSeenAt ?? "";
    const cmp = tb.localeCompare(ta);
    if (cmp !== 0) {
      return cmp;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Daily Review: up to {@link DAILY_REVIEW_MAX_WORDS} words.
 * Priority: due → oldest upcoming review candidates → newest learned fallback.
 */
export function buildDailyReviewSessionWords(
  bundle: RevisionWordBundle,
): VocabularyWord[] {
  const { words, progressByWordId } = bundle;
  const max = DAILY_REVIEW_MAX_WORDS;
  if (words.length === 0) {
    return [];
  }

  const due = words.filter((w) => isDueForReview(progressByWordId[w.id]));
  const dueSorted = sortByMostUrgentDue(due, progressByWordId);
  const selected: VocabularyWord[] = [];
  const taken = new Set<string>();

  for (const w of dueSorted) {
    if (selected.length >= max) {
      break;
    }
    selected.push(w);
    taken.add(w.id);
  }

  if (selected.length < max) {
    const notDue = words.filter(
      (w) =>
        !taken.has(w.id) && !isDueForReview(progressByWordId[w.id]),
    );
    const upcoming = sortBySoonestUpcomingReview(notDue, progressByWordId);
    for (const w of upcoming) {
      if (selected.length >= max) {
        break;
      }
      selected.push(w);
      taken.add(w.id);
    }
  }

  if (selected.length < max) {
    const rest = words.filter((w) => !taken.has(w.id));
    const newest = sortByNewestLearned(rest, progressByWordId);
    for (const w of newest) {
      if (selected.length >= max) {
        break;
      }
      selected.push(w);
      taken.add(w.id);
    }
  }

  return selected;
}

/** Newest known words first, capped. */
export function buildRecentlyLearnedSessionWords(
  bundle: RevisionWordBundle,
): VocabularyWord[] {
  const { words, progressByWordId } = bundle;
  if (words.length === 0) {
    return [];
  }
  const sorted = sortByNewestLearned(words, progressByWordId);
  return sorted.slice(0, RECENTLY_LEARNED_MAX_WORDS);
}

/** Random known words, no SRS weighting. */
export function buildQuickPracticeSessionWords(
  bundle: RevisionWordBundle,
  count: number,
  sortPrefs: RevisionSortPrefs,
): VocabularyWord[] {
  const sorted = sortKnownWordsForRevision(
    bundle.words,
    bundle.progressByWordId,
    sortPrefs,
  );
  const shuffled = shuffleArray(sorted);
  const n = Math.min(count, shuffled.length);
  return shuffled.slice(0, n);
}

/**
 * Zestaw słów dla wybranego trybu (przed lokalnym shuffle w sesji fiszek).
 */
export function buildSessionWordList(
  bundle: RevisionWordBundle,
  config: RevisionSessionConfig,
  sortPrefs: RevisionSortPrefs,
): VocabularyWord[] {
  switch (config.kind) {
    case "daily": {
      logger.info(LogTag.REVISION_SESSION, "Building Daily Review session");
      return buildDailyReviewSessionWords(bundle);
    }
    case "quick": {
      logger.info(LogTag.REVISION_SESSION, "Building Quick Practice session");
      return buildQuickPracticeSessionWords(bundle, config.count, sortPrefs);
    }
    case "recent": {
      logger.info(LogTag.REVISION_SESSION, "Building Recently Learned session");
      return buildRecentlyLearnedSessionWords(bundle);
    }
    case "category":
    case "custom":
      return [];
    default:
      return [];
  }
}

/**
 * Liczba kart dla trybu (hub — bez Supabase).
 */
export function countWordsForMode(
  bundle: RevisionWordBundle,
  config: RevisionSessionConfig,
): number {
  switch (config.kind) {
    case "daily":
      return buildDailyReviewSessionWords(bundle).length;
    case "quick":
      return Math.min(config.count, bundle.words.length);
    case "recent":
      return buildRecentlyLearnedSessionWords(bundle).length;
    case "category":
    case "custom":
      return 0;
    default:
      return 0;
  }
}
