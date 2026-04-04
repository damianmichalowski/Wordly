import type { QueryClient } from "@tanstack/react-query";

import { getOrCreateDailyWord } from "@/src/features/daily-word/services/dailyWord.service";
import type { DailyWordResult } from "@/src/features/daily-word/types/dailyWord.types";
import { getWordDetails } from "@/src/features/word-details/services/wordDetails.service";

import { queryKeys } from "./queryKeys";
import { staleTimes } from "./staleTimes";

/**
 * Shared `queryFn` for `queryKeys.dailyWord.current` (Home, prefetch, widget sync).
 * Uses `fetchQuery` for word details so a warm `words.detail` cache avoids a duplicate
 * `get_word_details` when assignment matches an already-fetched card.
 */
export function createDailyWordCurrentQueryFn(queryClient: QueryClient) {
  return async (): Promise<DailyWordResult | null> => {
    const assignment = await getOrCreateDailyWord();
    if (!assignment) {
      return null;
    }
    const details = await queryClient.fetchQuery({
      queryKey: queryKeys.words.detail(assignment.word_id),
      queryFn: () => getWordDetails(assignment.word_id),
      staleTime: staleTimes.wordDetails,
    });
    return { assignment, details };
  };
}
