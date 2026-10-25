import type { QueryClient } from "@tanstack/react-query";

import type { DailyWordResult } from "@/src/features/daily-word/types/dailyWord.types";
import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";
import {
  emitWordDifficultToggled,
  emitWordProgressUpdated,
} from "@/src/events/wordProgressEvents";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { clearAllRevisionSessionDecks } from "@/src/services/revision/revisionSessionDeckCache";
import {
  setWordDifficult,
  setWordDifficultCorrectStreak,
  setWordDifficultDontKnowCounter,
} from "@/src/services/wordProgress/wordProgress.service";
import type { VocabularyWord } from "@/src/types/words";

function clearedWordDetailsFields(): Pick<
  WordDetails,
  "is_difficult" | "difficult_dont_know_counter" | "difficult_correct_streak"
> {
  return {
    is_difficult: null,
    difficult_dont_know_counter: 0,
    difficult_correct_streak: 0,
  };
}

function patchWordDetailsListGraduated(
  list: WordDetails[] | undefined,
  wordId: string,
): WordDetails[] | undefined {
  if (!list?.length) {
    return list;
  }
  const cleared = clearedWordDetailsFields();
  return list.map((d) =>
    d.word_id === wordId ? { ...d, ...cleared } : d,
  );
}

/** Clears difficult flags in React Query caches after mastery graduation. */
export function patchWordGraduatedFromDifficult(
  queryClient: QueryClient,
  wordId: string,
): void {
  const cleared = clearedWordDetailsFields();

  queryClient.setQueryData<WordDetails>(queryKeys.words.detail(wordId), (old) =>
    old ? { ...old, ...cleared } : old,
  );

  queryClient.setQueryData<DailyWordResult | null>(
    queryKeys.dailyWord.current,
    (old) => {
      if (!old || old.details.word_id !== wordId) {
        return old;
      }
      return {
        ...old,
        details: { ...old.details, ...cleared },
      };
    },
  );

  queryClient.setQueriesData<VocabularyWord[]>(
    { queryKey: queryKeys.library.allKnownWords },
    (old) =>
      old?.map((w) =>
        w.id === wordId
          ? {
              ...w,
              isDifficult: undefined,
              difficultDontKnowCounter: 0,
              difficultCorrectStreak: 0,
            }
          : w,
      ) ?? old,
  );

  queryClient.setQueriesData<WordDetails[]>(
    {
      predicate: (q) =>
        q.queryKey[0] === "revision" &&
        (q.queryKey[1] === "recentlyLearnedDeck" ||
          q.queryKey[1] === "quickPracticeDeck" ||
          q.queryKey[1] === "difficultWordsDeck"),
    },
    (old) => patchWordDetailsListGraduated(old, wordId),
  );
}

/** Clears difficult flag, counters, and streak in DB and React Query caches. */
export async function persistWordDifficultCleared(
  queryClient: QueryClient,
  wordId: string,
): Promise<void> {
  await setWordDifficult(wordId, false);
  await setWordDifficultCorrectStreak(wordId, 0);
  await setWordDifficultDontKnowCounter(wordId, 0);
  patchWordGraduatedFromDifficult(queryClient, wordId);
}

/**
 * Persists mastery graduation (DB + local cache).
 * `set_word_difficult(false)` clears `difficult_marked_at` on the server.
 */
export async function graduateWordFromDifficultSession(
  queryClient: QueryClient,
  wordId: string,
): Promise<void> {
  await persistWordDifficultCleared(queryClient, wordId);
  emitWordDifficultToggled({
    wordId,
    isDifficult: false,
    difficultDontKnowCounter: 0,
  });
}

/** Refreshes hub, library, word details, and revision decks after graduation. */
export async function invalidateAfterDifficultWordsGraduation(
  queryClient: QueryClient,
  graduatedWordIds: string[],
): Promise<void> {
  if (graduatedWordIds.length === 0) {
    return;
  }

  await clearAllRevisionSessionDecks();
  emitWordProgressUpdated();

  for (const wordId of graduatedWordIds) {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.words.detail(wordId),
    });
  }

  await queryClient.invalidateQueries({
    queryKey: queryKeys.library.allKnownWords,
  });
  await queryClient.invalidateQueries({
    queryKey: queryKeys.revision.hubStats,
  });
  await queryClient.invalidateQueries({
    predicate: (q) =>
      q.queryKey[0] === "revision" &&
      (q.queryKey[1] === "difficultWordsDeck" ||
        q.queryKey[1] === "recentlyLearnedDeck" ||
        q.queryKey[1] === "quickPracticeDeck"),
  });
}
