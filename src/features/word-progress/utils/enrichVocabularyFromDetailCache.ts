import type { QueryClient } from "@tanstack/react-query";

import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";
import { queryKeys } from "@/src/lib/query/queryKeys";
import type { VocabularyWord } from "@/src/types/words";

export function enrichVocabularyFromDetailCache(
  queryClient: QueryClient,
  words: VocabularyWord[],
): VocabularyWord[] {
  return words.map((w) => {
    const cached = queryClient.getQueryData<WordDetails>(
      queryKeys.words.detail(w.id),
    );
    if (!cached) {
      return w;
    }
    let next = w;
    if (cached.is_difficult === true) {
      next = { ...next, isDifficult: true };
    } else if (cached.is_difficult === false) {
      next = {
        ...next,
        isDifficult: undefined,
        difficultDontKnowCounter: cached.difficult_dont_know_counter ?? 0,
        difficultCorrectStreak: cached.difficult_correct_streak ?? 0,
      };
    } else if (cached.difficult_dont_know_counter != null) {
      next = {
        ...next,
        difficultDontKnowCounter: cached.difficult_dont_know_counter,
      };
    }
    if (cached.categories.length > 0 && !next.categories?.length) {
      next = {
        ...next,
        categories: cached.categories.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
        })),
      };
    }
    return next;
  });
}
