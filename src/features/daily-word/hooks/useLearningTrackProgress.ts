import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import type { LearningTrackProgress } from "@/src/features/profile/services/learningProgress.service";
import { TRANSPORT_RETRY_SUBTITLE } from "@/src/components/ui/transportRetry.constants";
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

  const errorMessage = query.isError ? TRANSPORT_RETRY_SUBTITLE : null;

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    isLoading: !query.isFetched && !query.isError,
    error: errorMessage,
    data: query.data ?? null,
    refresh,
  };
}
