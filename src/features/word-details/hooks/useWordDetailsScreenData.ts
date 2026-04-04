import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";

import {
  computeWordDetailsScreenPanel,
  type WordDetailsScreenPanel,
} from "./wordDetailsScreenViewModel";
import { useWordDetailsQuery } from "./useWordDetailsQuery";

/**
 * Word Details route: query + normalized `panel` for rendering (no mixed error/empty/skeleton).
 */
export function useWordDetailsScreenData(): {
  wordId: string;
  panel: WordDetailsScreenPanel;
  refetch: () => void;
} {
  const params = useLocalSearchParams<{
    wordId?: string | string[];
    senseId?: string | string[];
  }>();

  const rawWordId = params.wordId ?? params.senseId;
  const wordId =
    typeof rawWordId === "string" ? rawWordId : (rawWordId?.[0] ?? "");

  const query = useWordDetailsQuery(
    wordId.trim().length > 0 ? wordId : undefined,
  );

  const panel = useMemo(
    () => computeWordDetailsScreenPanel(wordId, query),
    [
      wordId,
      query.data,
      query.error,
      query.isError,
      query.isPending,
      query.isFetching,
    ],
  );

  return {
    wordId,
    panel,
    refetch: () => {
      void query.refetch();
    },
  };
}
