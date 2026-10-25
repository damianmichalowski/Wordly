import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";
import { queryKeys } from "@/src/lib/query/queryKeys";

export function useWordDetailsCacheEntry(
  wordId: string,
): WordDetails | undefined {
  const queryClient = useQueryClient();
  const detailKey = queryKeys.words.detail(wordId);

  return useSyncExternalStore(
    (onStoreChange) =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.query.queryKey.join("\0") === detailKey.join("\0")) {
          onStoreChange();
        }
      }),
    () => queryClient.getQueryData<WordDetails>(detailKey),
    () => queryClient.getQueryData<WordDetails>(detailKey),
  );
}
