import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import type { LearningTrackProgress } from "@/src/features/profile/services/learningProgress.service";
import { getLearningTrackProgress } from "@/src/features/profile/services/learningProgress.service";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { staleTimes } from "@/src/lib/query/staleTimes";

export function useLearningTrackProgress() {
  const query = useQuery<LearningTrackProgress>({
    queryKey: queryKeys.learning.trackProgress,
    queryFn: getLearningTrackProgress,
    staleTime: staleTimes.learningTrackProgress,
    placeholderData: keepPreviousData,
  });

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    isLoading: !query.isFetched && !query.isError,
    data: query.data ?? null,
    refresh,
  };
}
