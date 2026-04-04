import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getUserProfileSettings } from "@/src/features/profile/services/profile.service";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { staleTimes } from "@/src/lib/query/staleTimes";

/**
 * Shared profile/settings resolution for tabs that need the same gating semantics as Settings:
 * success + `null` row → onboarding; fetch error with no cache → blocking retry.
 */
export function useProfileSettingsGate() {
  const settingsQuery = useQuery({
    queryKey: queryKeys.profile.settings,
    queryFn: getUserProfileSettings,
    staleTime: staleTimes.profileSettings,
    placeholderData: keepPreviousData,
  });

  const settingsResolved = settingsQuery.isFetched;
  const onboardingRequiredConfirmed =
    settingsQuery.isSuccess && settingsQuery.data === null;
  const settingsFetchError =
    settingsQuery.isFetched &&
    settingsQuery.isError &&
    settingsQuery.data === undefined;
  const hasProfile = Boolean(settingsQuery.data);
  const settingsRetryBusy =
    settingsFetchError && settingsQuery.isFetching;

  return {
    settingsQuery,
    settingsResolved,
    onboardingRequiredConfirmed,
    settingsFetchError,
    settingsRetryBusy,
    hasProfile,
  };
}
