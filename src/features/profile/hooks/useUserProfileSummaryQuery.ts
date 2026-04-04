import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  getUserProfileSummary,
  type UserProfileSummaryDto,
} from "@/src/features/achievements/services/achievements.service";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { staleTimes } from "@/src/lib/query/staleTimes";

export function useUserProfileSummaryQuery(enabled: boolean) {
  return useQuery<UserProfileSummaryDto>({
    queryKey: queryKeys.profile.summary,
    queryFn: getUserProfileSummary,
    enabled,
    staleTime: staleTimes.profileSummary,
    placeholderData: keepPreviousData,
  });
}
