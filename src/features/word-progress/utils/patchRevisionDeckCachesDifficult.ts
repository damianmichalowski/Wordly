import type { QueryClient } from "@tanstack/react-query";

import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";
import { queryKeys } from "@/src/lib/query/queryKeys";

function patchWordDetailsList(
  list: WordDetails[] | undefined,
  wordId: string,
  isDifficult: boolean,
): WordDetails[] | undefined {
  if (!list?.length) {
    return list;
  }
  return list.map((d) =>
    d.word_id === wordId ? { ...d, is_difficult: isDifficult } : d,
  );
}

export function patchRevisionDeckCachesDifficult(
  queryClient: QueryClient,
  wordId: string,
  isDifficult: boolean,
): void {
  queryClient.setQueriesData<WordDetails[]>(
    {
      predicate: (q) =>
        q.queryKey[0] === "revision" &&
        (q.queryKey[1] === "recentlyLearnedDeck" ||
          q.queryKey[1] === "quickPracticeDeck"),
    },
    (old) => patchWordDetailsList(old, wordId, isDifficult),
  );
}
