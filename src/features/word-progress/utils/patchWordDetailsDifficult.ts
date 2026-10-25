import type { QueryClient } from "@tanstack/react-query";

import type { DailyWordResult } from "@/src/features/daily-word/types/dailyWord.types";
import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";
import { patchRevisionDeckCachesDifficult } from "@/src/features/word-progress/utils/patchRevisionDeckCachesDifficult";
import { queryKeys } from "@/src/lib/query/queryKeys";
import type { VocabularyWord } from "@/src/types/words";

export function patchWordDetailsIsDifficult(
  queryClient: QueryClient,
  wordId: string,
  isDifficult: boolean,
): void {
  queryClient.setQueryData<WordDetails>(queryKeys.words.detail(wordId), (old) =>
    old
      ? {
          ...old,
          is_difficult: isDifficult,
          difficult_dont_know_counter: isDifficult
            ? 0
            : old.difficult_dont_know_counter,
        }
      : old,
  );

  queryClient.setQueryData<DailyWordResult | null>(
    queryKeys.dailyWord.current,
    (old) => {
      if (!old || old.details.word_id !== wordId) {
        return old;
      }
      return {
        ...old,
        details: { ...old.details, is_difficult: isDifficult },
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
              isDifficult,
              difficultDontKnowCounter: isDifficult
                ? 0
                : w.difficultDontKnowCounter,
            }
          : w,
      ) ?? old,
  );

  patchRevisionDeckCachesDifficult(queryClient, wordId, isDifficult);
}

function patchWordDetailsListCounter(
  list: WordDetails[] | undefined,
  wordId: string,
  counter: number,
): WordDetails[] | undefined {
  if (!list?.length) {
    return list;
  }
  return list.map((d) =>
    d.word_id === wordId ? { ...d, difficult_dont_know_counter: counter } : d,
  );
}

/** Updates counter only; does not change `is_difficult` (RPC matches). */
export function patchWordDetailsDontKnowCounter(
  queryClient: QueryClient,
  wordId: string,
  counter: number,
): void {
  queryClient.setQueryData<WordDetails>(queryKeys.words.detail(wordId), (old) =>
    old ? { ...old, difficult_dont_know_counter: counter } : old,
  );

  queryClient.setQueriesData<VocabularyWord[]>(
    { queryKey: queryKeys.library.allKnownWords },
    (old) =>
      old?.map((w) =>
        w.id === wordId ? { ...w, difficultDontKnowCounter: counter } : w,
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
    (old) => patchWordDetailsListCounter(old, wordId, counter),
  );
}
