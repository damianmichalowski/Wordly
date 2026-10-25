import { keepPreviousData, useQuery } from "@tanstack/react-query";

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

  return {
    isLoading: !query.isFetched && !query.isError,
    data: query.data ?? null,
    refresh: query.refetch,
  };
}
