import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getWordDetails } from "@/src/features/word-details/services/wordDetails.service";
import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { staleTimes } from "@/src/lib/query/staleTimes";

export function useWordDetailsQuery(wordId: string | undefined) {
  const id = wordId?.trim() ?? "";
  return useQuery<WordDetails>({
    queryKey: queryKeys.words.detail(id),
    queryFn: () => getWordDetails(id),
    enabled: id.length > 0,
    staleTime: staleTimes.wordDetails,
    placeholderData: keepPreviousData,
  });
}
