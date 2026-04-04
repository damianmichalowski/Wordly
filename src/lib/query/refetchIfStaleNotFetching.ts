import type { QueryObserverResult } from "@tanstack/react-query";

/**
 * Tab-focus / manual coalescing: avoid stacking a second network request while the same
 * query already has an in-flight fetch (initial load + focus refetch overlap).
 */
export function refetchIfStaleNotFetching(
  q: Pick<QueryObserverResult<unknown, Error>, "isStale" | "isFetching" | "refetch">,
): void {
  if (q.isStale && !q.isFetching) {
    void q.refetch();
  }
}
