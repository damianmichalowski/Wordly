import { useQuery } from "@tanstack/react-query";

import {
  getUserAchievementsList,
  type UserAchievementRow,
} from "@/src/features/achievements/services/achievements.service";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { staleTimes } from "@/src/lib/query/staleTimes";

/**
 * Lista trofeów dla Ustawień. Gdy `enabled` jest false, nie pobiera (np. brak Supabase).
 */
export function useUserAchievementsList(enabled: boolean) {
  const query = useQuery<UserAchievementRow[]>({
    queryKey: queryKeys.achievements.list,
    queryFn: getUserAchievementsList,
    enabled,
    staleTime: staleTimes.achievementsList,
  });

  /** Nie pokazujemy surowego `Error.message` w UI — tylko flaga + copy w komponencie. */
  const hasLoadError = enabled && query.isError;

  /** Pierwszy fetch przy włączonym query — nie mylić z `rows === null` po błędzie (tam jest `hasLoadError`). */
  const isInitialLoading =
    enabled && !query.isFetched && !query.isError;

  const retryBusy = enabled && query.isFetching && query.isError;

  return {
    rows: query.data ?? null,
    hasLoadError,
    isInitialLoading,
    retryBusy,
    reload: query.refetch,
  };
}
