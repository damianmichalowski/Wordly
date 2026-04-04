import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { TRANSPORT_RETRY_SUBTITLE } from "@/src/components/ui/transportRetry.constants";
import { getUserProfileSettings } from "@/src/features/profile/services/profile.service";
import type { UserProfileSettings } from "@/src/features/profile/types/profile.types";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { staleTimes } from "@/src/lib/query/staleTimes";

export function useUserProfileSettings() {
  const query = useQuery<UserProfileSettings | null>({
    queryKey: queryKeys.profile.settings,
    queryFn: getUserProfileSettings,
    staleTime: staleTimes.profileSettings,
    placeholderData: keepPreviousData,
  });

  const errorMessage = query.isError ? TRANSPORT_RETRY_SUBTITLE : null;

  return {
    isLoading: !query.isFetched && !query.isError,
    error: errorMessage,
    data: query.data ?? null,
    refresh: query.refetch,
  };
}
