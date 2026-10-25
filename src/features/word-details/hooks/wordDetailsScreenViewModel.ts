import type { UseQueryResult } from "@tanstack/react-query";

import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";

/**
 * Word Details: separate invalid id, unresolved fetch, confirmed error, and content
 * (cache/placeholder wins over blocking shell when data is present).
 */
export type WordDetailsScreenPanel =
  | { kind: "invalid_id" }
  | { kind: "loading_shell" }
  | { kind: "content"; details: WordDetails };

export function computeWordDetailsScreenPanel(
  rawWordId: string,
  query: UseQueryResult<WordDetails>,
): WordDetailsScreenPanel {
  const wordId = rawWordId.trim();
  if (wordId.length === 0) {
    return { kind: "invalid_id" };
  }

  const details = query.data ?? null;
  const unresolvedLoading =
    details === null &&
    !query.isError &&
    (query.isPending || query.isFetching);

  if (unresolvedLoading) {
    return { kind: "loading_shell" };
  }

  if (query.isError && !details) {
    return { kind: "loading_shell" };
  }

  if (!details) {
    return { kind: "loading_shell" };
  }

  return { kind: "content", details };
}
