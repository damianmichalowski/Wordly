import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useProfileSettingsGate } from "@/src/features/profile/hooks/useProfileSettingsGate";
import {
  computeLibraryTabViewKind,
  type LibraryTabViewKind,
} from "@/src/features/library/hooks/libraryTabViewModel";
import { fetchAllLibraryWords } from "@/src/features/library/services/fetchAllLibraryWords";
import { getLibraryOverview } from "@/src/features/library/services/libraryOverview.service";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { refetchIfStaleNotFetching } from "@/src/lib/query/refetchIfStaleNotFetching";
import { staleTimes } from "@/src/lib/query/staleTimes";
import {
  DEFAULT_REVISION_SORT_PREFS,
  loadRevisionSortPrefs,
  saveRevisionSortPrefs,
  type RevisionSortPrefs,
} from "@/src/services/revision/revisionSortPrefs";
import { LIBRARY_TIER_CEFR_LEVELS, type LibraryLevelTier } from "@/src/types/cefr";
import type { LibraryCollectionFilter } from "@/src/types/revisionTracking";
import type { VocabularyWord } from "@/src/types/words";

const SEARCH_DEBOUNCE_MS = 300;
const EMPTY_CEFR: string[] = [];

/**
 * Library tab: known-word list, sort prefs, search, CEFR/collection filters, and settings/onboarding gates.
 * All filtering is backend-backed via RPC params — no client-side filtering on paginated results.
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
    hasProfile,
  } = gate;

  // ── Filter state (lifted from KnownWordsList) ─────────────────────────

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTiers, setSelectedTiers] = useState<LibraryLevelTier[]>([]);
  const [selectedCollection, setSelectedCollection] =
    useState<LibraryCollectionFilter | null>(null);

  const [sortPrefs, setSortPrefsState] =
    useState<RevisionSortPrefs>(DEFAULT_REVISION_SORT_PREFS);

  useEffect(() => {
    void loadRevisionSortPrefs().then((prefs) => setSortPrefsState(prefs));
  }, []);

  const setRevisionSortPrefs = useCallback((prefs: RevisionSortPrefs) => {
    setSortPrefsState(prefs);
    void saveRevisionSortPrefs(prefs);
  }, []);

  // ── Debounce search ───────────────────────────────────────────────────

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setDebouncedSearch("");
      return;
    }
    const timer = setTimeout(() => setDebouncedSearch(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Derived filter params ─────────────────────────────────────────────

  const cefrCodes = useMemo(() => {
    if (selectedTiers.length === 0) return undefined;
    const codes: string[] = [];
    for (const t of selectedTiers) {
      for (const lvl of LIBRARY_TIER_CEFR_LEVELS[t]) {
        codes.push(lvl);
      }
    }
    return codes;
  }, [selectedTiers]);

  const sortKnownAt: "asc" | "desc" =
    sortPrefs.timeOrder === "oldest" ? "asc" : "desc";

  // ── Library words query (all filters in key + RPC call) ───────────────

  const stableCefrCodes = cefrCodes ?? EMPTY_CEFR;

  const libraryQueryKey = useMemo(
    () => [
      ...queryKeys.library.allKnownWords,
      selectedCollection ?? "all",
      debouncedSearch,
      stableCefrCodes,
      sortKnownAt,
    ],
    [selectedCollection, debouncedSearch, stableCefrCodes, sortKnownAt],
  );

  const libraryQuery = useQuery({
    queryKey: libraryQueryKey,
    queryFn: () =>
      fetchAllLibraryWords({
        collection: selectedCollection ?? undefined,
        search: debouncedSearch || undefined,
        cefrCodes,
        sortKnownAt,
      }),
    enabled: hasProfile && isFocused,
    staleTime: staleTimes.libraryAllKnownWords,
    placeholderData: keepPreviousData,
  });

  // ── Overview query ────────────────────────────────────────────────────

  const overviewQuery = useQuery({
    queryKey: queryKeys.library.overview,
    queryFn: getLibraryOverview,
    enabled: hasProfile && isFocused,
    staleTime: staleTimes.libraryOverview,
    placeholderData: keepPreviousData,
  });

  // ── Derived state ─────────────────────────────────────────────────────

  const knownWords: VocabularyWord[] = libraryQuery.data ?? [];

  const hasActiveFilters =
    Boolean(selectedCollection) ||
    Boolean(debouncedSearch) ||
    selectedTiers.length > 0;

  const libraryListHydrating = useMemo(() => {
    if (!hasProfile) {
      return !settingsResolved || Boolean(settingsFetchError);
    }
    return !libraryQuery.isFetched;
  }, [hasProfile, settingsResolved, settingsFetchError, libraryQuery.isFetched]);

  const libraryUnlockEmptyConfirmed = useMemo(() => {
    if (hasActiveFilters) return false;
    if (!hasProfile) return false;
    if (!libraryQuery.isFetched) return false;
    const words = libraryQuery.data;
    if (words == null) return false;
    return words.length === 0;
  }, [hasProfile, libraryQuery.isFetched, libraryQuery.data, hasActiveFilters]);

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
  const libraryRefreshing = libraryFetchBusy && libraryQuery.isFetched;

  // ── Refresh / focus ───────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.settings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.revision.hubStats }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.summary }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.library.allKnownWords,
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.library.overview,
      }),
    ]);
  }, [queryClient]);

  const gateQueriesRef = useRef({
    settingsQuery,
    libraryQuery,
    overviewQuery,
    hasProfile,
  });
  gateQueriesRef.current = { settingsQuery, libraryQuery, overviewQuery, hasProfile };

  useFocusEffect(
    useCallback(() => {
      const { settingsQuery: sq, libraryQuery: lq, overviewQuery: oq, hasProfile: hp } =
        gateQueriesRef.current;
      refetchIfStaleNotFetching(sq);
      if (!hp) {
        return;
      }
      refetchIfStaleNotFetching(lq);
      refetchIfStaleNotFetching(oq);
    }, []),
  );

  // ── View kind ─────────────────────────────────────────────────────────

  const viewKind: LibraryTabViewKind = useMemo(
    () =>
      computeLibraryTabViewKind({
        onboardingRequiredConfirmed,
      }),
    [onboardingRequiredConfirmed],
  );

  return {
    viewKind,
    settingsResolved,
    libraryListHydrating,
    libraryUnlockEmptyConfirmed,
    libraryDisplayKnownCount,
    libraryLoadError,
    libraryFetchBusy,
    libraryRefreshing,
    knownWords,
    sortPrefs,
    setRevisionSortPrefs,
    refresh,
    overviewData: overviewQuery.data,
    overviewLoading: overviewQuery.isLoading,
    overviewError: overviewQuery.isError,
    selectedCollection,
    setSelectedCollection,
    searchQuery,
    setSearchQuery,
    selectedTiers,
    setSelectedTiers,
    hasActiveFilters,
  };
}
