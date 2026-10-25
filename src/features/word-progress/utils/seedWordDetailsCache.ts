import type { QueryClient } from "@tanstack/react-query";

import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";
import { queryKeys } from "@/src/lib/query/queryKeys";

export function seedWordDetailsCache(
  queryClient: QueryClient,
  details: WordDetails[],
): void {
  for (const d of details) {
    const key = queryKeys.words.detail(d.word_id);
    const existing = queryClient.getQueryData<WordDetails>(key);
    queryClient.setQueryData(key, existing ? { ...existing, ...d } : d);
  }
}
