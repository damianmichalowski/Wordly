import type { RevisionSessionConfig } from "@/src/types/revisionSession";
import type { CefrLevel } from "@/src/types/cefr";
import type { UserWordProgress } from "@/src/types/progress";
import type { VocabularyWord } from "@/src/types/words";

import type { RevisionSortPrefs } from "@/src/services/revision/revisionSortPrefs";
import { sortKnownWordsForRevision } from "@/src/services/revision/revisionSort";
import {
  isDueForReview,
} from "@/src/services/revision/spacedRepetition";
import { shuffleArray } from "@/src/utils/shuffleArray";

export type RevisionWordBundle = {
  words: VocabularyWord[];
  progressByWordId: Record<string, UserWordProgress>;
};

function filterDueToday(
  words: VocabularyWord[],
  progressByWordId: Record<string, UserWordProgress>,
): VocabularyWord[] {
  return words.filter((w) => isDueForReview(progressByWordId[w.id]));
}

function sortByNextReviewThenId(
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

function filterDifficult(
  words: VocabularyWord[],
  progressByWordId: Record<string, UserWordProgress>,
): VocabularyWord[] {
  const scored = words
    .map((w) => {
      const p = progressByWordId[w.id];
      if (!p) {
        return null;
      }
      const ds = p.difficultyScore ?? 0;
      const due = isDueForReview(p) ? 1 : 0;
      const last = p.lastReviewedAt ?? "";
      return { w, ds, due, last };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  scored.sort((a, b) => {
    if (b.ds !== a.ds) {
      return b.ds - a.ds;
    }
    if (b.due !== a.due) {
      return b.due - a.due;
    }
    if (a.last !== b.last) {
      return a.last.localeCompare(b.last);
    }
    return a.w.id.localeCompare(b.w.id);
  });
  return scored.map((s) => s.w);
}

function filterRecentlyLearned(
  words: VocabularyWord[],
  progressByWordId: Record<string, UserWordProgress>,
): VocabularyWord[] {
  const withDates = words
    .map((w) => ({ w, p: progressByWordId[w.id] }))
    .filter(
      (x): x is { w: VocabularyWord; p: UserWordProgress } =>
        Boolean(x.p?.markedKnownAt),
    )
    .sort((a, b) =>
      (b.p.markedKnownAt ?? "").localeCompare(a.p.markedKnownAt ?? ""),
    );

  const sevenDaysMs = 7 * 86400000;
  const cutoff = Date.now() - sevenDaysMs;
  const in7 = withDates.filter(
    (x) => new Date(x.p.markedKnownAt!).getTime() >= cutoff,
  );
  const pool = in7.length > 0 ? in7 : withDates.slice(0, 20);
  return pool.slice(0, 20).map((x) => x.w);
}

function filterByLevel(
  words: VocabularyWord[],
  level: CefrLevel,
): VocabularyWord[] {
  return words.filter((w) => w.cefrLevel === level);
}

/**
 * Zestaw słów dla wybranego trybu (przed lokalnym wyszukiwaniem / sortem z arkusza).
 */
export function buildSessionWordList(
  bundle: RevisionWordBundle,
  config: RevisionSessionConfig,
  sortPrefs: RevisionSortPrefs,
): VocabularyWord[] {
  const { words, progressByWordId } = bundle;

  switch (config.kind) {
    case "daily": {
      const due = filterDueToday(words, progressByWordId);
      return sortByNextReviewThenId(due, progressByWordId);
    }
    case "quick": {
      const sorted = sortKnownWordsForRevision(
        words,
        progressByWordId,
        sortPrefs,
      );
      const shuffled = shuffleArray(sorted);
      const n = Math.min(config.count, shuffled.length);
      return shuffled.slice(0, n);
    }
    case "difficult": {
      const difficult = filterDifficult(words, progressByWordId);
      return difficult;
    }
    case "recent": {
      return filterRecentlyLearned(words, progressByWordId);
    }
    case "level": {
      const levelWords = filterByLevel(words, config.level);
      return sortKnownWordsForRevision(
        levelWords,
        progressByWordId,
        sortPrefs,
      );
    }
    case "category":
    case "custom":
      return [];
  }
}

/**
 * Liczba słów do wyświetlenia przy karcie trybu (hub).
 * Dla `level` bez kontekstu użyj `previewLevel` (np. `profile.displayLevel`).
 */
export function countWordsForMode(
  bundle: RevisionWordBundle,
  config: RevisionSessionConfig,
): number {
  const { words, progressByWordId } = bundle;

  switch (config.kind) {
    case "daily":
      return filterDueToday(words, progressByWordId).length;
    case "quick":
      return Math.min(config.count, words.length);
    case "difficult":
      return filterDifficult(words, progressByWordId).length;
    case "recent":
      return filterRecentlyLearned(words, progressByWordId).length;
    case "level":
      return filterByLevel(words, config.level).length;
    case "category":
    case "custom":
      return 0;
  }
}

/** Podgląd liczby dla „Ćwicz według poziomu” zanim użytkownik wybierze poziom. */
export function countWordsForLevelPreview(
  bundle: RevisionWordBundle,
  level: CefrLevel,
): number {
  return filterByLevel(bundle.words, level).length;
}
