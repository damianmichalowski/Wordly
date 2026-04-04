import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useProfileSettingsGate } from "@/src/features/profile/hooks/useProfileSettingsGate";
import {
  computeLibraryTabViewKind,
  type LibraryTabViewKind,
} from "@/src/features/library/hooks/libraryTabViewModel";
import { fetchAllLibraryWords } from "@/src/features/library/services/fetchAllLibraryWords";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { refetchIfStaleNotFetching } from "@/src/lib/query/refetchIfStaleNotFetching";
import { staleTimes } from "@/src/lib/query/staleTimes";
import {
  DEFAULT_REVISION_SORT_PREFS,
  loadRevisionSortPrefs,
  saveRevisionSortPrefs,
  type RevisionSortPrefs,
} from "@/src/services/revision/revisionSortPrefs";
import type { VocabularyWord } from "@/src/types/words";

/**
 * Library tab: known-word list, sort prefs, and settings/onboarding gates.
 * Review sessions and hub stats live in `useRevisionHubSession`, not here.
 */
export function useLibraryScreenData() {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const gate = useProfileSettingsGate();
  const {
    settingsQuery,
    settingsResolved,
    onboardingRequiredConfirmed,
    settingsFetchError,
    settingsRetryBusy,
    hasProfile,
  } = gate;

  const libraryQuery = useQuery({
    queryKey: queryKeys.library.allKnownWords,
    queryFn: fetchAllLibraryWords,
    enabled: hasProfile && isFocused,
    staleTime: staleTimes.libraryAllKnownWords,
    placeholderData: keepPreviousData,
  });

  const [sortPrefs, setSortPrefsState] =
    useState<RevisionSortPrefs>(DEFAULT_REVISION_SORT_PREFS);

  useEffect(() => {
    void loadRevisionSortPrefs().then((prefs) => setSortPrefsState(prefs));
  }, []);

  const setRevisionSortPrefs = useCallback((prefs: RevisionSortPrefs) => {
    setSortPrefsState(prefs);
    void saveRevisionSortPrefs(prefs);
  }, []);

  const knownWords: VocabularyWord[] = libraryQuery.data ?? [];

  /** Until the first successful library query for this profile, list shells avoid false empty states. */
  const libraryListHydrating = hasProfile && !libraryQuery.isFetched;

  const libraryUnlockEmptyConfirmed = useMemo(() => {
    if (!hasProfile) {
      return false;
    }
    if (!libraryQuery.isFetched) {
      return false;
    }
    const words = libraryQuery.data;
    if (words == null) {
      return false;
    }
    return words.length === 0;
  }, [hasProfile, libraryQuery.isFetched, libraryQuery.data]);

  const libraryDisplayKnownCount = useMemo(() => {
    if (!hasProfile) {
      return knownWords.length;
    }
    const fromQuery = libraryQuery.data;
    if (libraryQuery.isFetched && fromQuery != null) {
      return fromQuery.length;
    }
    return knownWords.length;
  }, [hasProfile, libraryQuery.isFetched, libraryQuery.data, knownWords.length]);

  const libraryLoadError = useMemo(
    () =>
      hasProfile &&
      libraryQuery.isFetched &&
      libraryQuery.isError,
    [hasProfile, libraryQuery.isFetched, libraryQuery.isError],
  );

  const libraryFetchBusy = hasProfile && libraryQuery.isFetching;

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.settings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.revision.hubStats }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.summary }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.library.allKnownWords,
      }),
    ]);
  }, [queryClient]);

  const gateQueriesRef = useRef({
    settingsQuery,
    libraryQuery,
    hasProfile,
  });
  gateQueriesRef.current = { settingsQuery, libraryQuery, hasProfile };

  useFocusEffect(
    useCallback(() => {
      const { settingsQuery: sq, libraryQuery: lq, hasProfile: hp } =
        gateQueriesRef.current;
      refetchIfStaleNotFetching(sq);
      if (!hp) {
        return;
      }
      refetchIfStaleNotFetching(lq);
    }, []),
  );

  const viewKind: LibraryTabViewKind = useMemo(
    () =>
      computeLibraryTabViewKind({
        settingsFetchError,
        onboardingRequiredConfirmed,
      }),
    [onboardingRequiredConfirmed, settingsFetchError],
  );

  return {
    viewKind,
    settingsResolved,
    settingsRetryBusy,
    libraryListHydrating,
    libraryUnlockEmptyConfirmed,
    libraryDisplayKnownCount,
    libraryLoadError,
    libraryFetchBusy,
    knownWords,
    sortPrefs,
    setRevisionSortPrefs,
    refresh,
  };
}
