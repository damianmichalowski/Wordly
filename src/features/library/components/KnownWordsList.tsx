import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";

import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { CenteredUnlockCtaCard } from "@/src/components/ui/CenteredUnlockCtaCard";
import {
  ANDROID_RIPPLE_ICON_ROUND,
  HIT_SLOP_MINI,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import {
  RevisionFiltersSheet,
  type RevisionFiltersApplyPayload,
} from "@/src/features/revision/components/RevisionFiltersSheet";
import { revisionScreenStyles as styles } from "@/src/features/revision/revisionScreenStyles";
import {
  LIBRARY_TIER_LABEL,
  type LibraryLevelTier,
} from "@/src/types/cefr";
import type { LibraryCollectionFilter, LibraryOverview } from "@/src/types/revisionTracking";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import { logUserAction } from "@/src/utils/userActionLog";
import type { VocabularyWord } from "@/src/types/words";

import type { RevisionSortPrefs } from "@/src/services/revision/revisionSortPrefs";

import {
  LibraryOverviewCard,
  LibraryOverviewSkeleton,
} from "./LibraryOverviewCard";
import { LibraryWordRow } from "./LibraryWordRow";
import { SmartCollectionGrid } from "./SmartCollectionGrid";

const LIST_SKEL_PREFIX = "__wordly_list_skel__";

function skeletonRowItems(count: number): VocabularyWord[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${LIST_SKEL_PREFIX}${i}`,
    sourceLanguageCode: "en" as VocabularyWord["sourceLanguageCode"],
    targetLanguageCode: "en" as VocabularyWord["targetLanguageCode"],
    sourceText: "",
    targetText: "",
    exampleSource: "",
    exampleTarget: "",
    cefrLevel: "A1" as VocabularyWord["cefrLevel"],
    knownAt: null,
  }));
}

function KnownWordRowSkeleton() {
  return (
    <View style={[styles.rowCard, styles.rowCardSkeleton]} pointerEvents="none">
      <View style={styles.rowMain}>
        <View style={styles.skeletonLine} />
      </View>
    </View>
  );
}

export type KnownWordsListProps = {
  knownWords: VocabularyWord[];
  sortPrefs: RevisionSortPrefs;
  onSortPrefsChange: (prefs: RevisionSortPrefs) => void;
  onOpenWord: (word: VocabularyWord) => void;
  showUnlockEmptyState?: boolean;
  onUnlockPrimaryPress?: () => void;
  headerTitle?: string;
  onBackPress?: () => void;
  backAccessibilityLabel?: string;
  listHydrating?: boolean;
  effectiveKnownCount?: number;
  suppressGenericEmptyMessage?: boolean;
  libraryLoadError?: boolean;
  overviewData?: LibraryOverview;
  overviewLoading?: boolean;
  selectedCollection?: LibraryCollectionFilter | null;
  onCollectionChange?: (c: LibraryCollectionFilter | null) => void;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  selectedTiers?: LibraryLevelTier[];
  onSelectedTiersChange?: (tiers: LibraryLevelTier[]) => void;
  hasActiveFilters?: boolean;
  refreshing?: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────────

function formatTiersList(tiers: LibraryLevelTier[]): string {
  return [...tiers].map((t) => LIBRARY_TIER_LABEL[t]).join(", ");
}

function buildEmptyFilterHint(
  selectedTiers: LibraryLevelTier[],
  q: string,
): string {
  const qTrim = q.trim();
  const tiersLabel = formatTiersList(selectedTiers);
  if (selectedTiers.length > 0 && qTrim) {
    return `No results for ${tiersLabel}, "${qTrim}"`;
  }
  if (selectedTiers.length > 0) {
    return `No words for selected levels (${tiersLabel})`;
  }
  return `No results for "${qTrim}"`;
}

function KnownWordsListEmpty({ hasSearch }: { hasSearch: boolean }) {
  return (
    <View style={styles.emptyList}>
      <Text style={styles.title}>
        {hasSearch ? "No results" : "No words yet"}
      </Text>
      <Text style={styles.subtitle}>
        {hasSearch
          ? "Try a different search term."
          : "Words you mark as known will appear here."}
      </Text>
    </View>
  );
}

// ── Header ───────────────────────────────────────────────────────────────

type KnownWordsListHeaderProps = {
  knownCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
  controlsDisabled?: boolean;
  listHydrating?: boolean;
  overviewData?: LibraryOverview;
  overviewLoading?: boolean;
  selectedCollection?: LibraryCollectionFilter | null;
  onCollectionChange?: (c: LibraryCollectionFilter | null) => void;
  refreshing?: boolean;
};

const KnownWordsListHeader = memo(function KnownWordsListHeader({
  knownCount,
  searchQuery,
  onSearchChange,
  onOpenFilters,
  activeFilterCount,
  controlsDisabled = false,
  listHydrating = false,
  overviewData,
  overviewLoading = false,
  selectedCollection,
  onCollectionChange,
  refreshing = false,
}: KnownWordsListHeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const showOverview = !controlsDisabled && knownCount > 0;

  return (
    <View style={styles.listHeaderBlock}>
      {refreshing ? (
        <View style={styles.refreshingRow}>
          <ActivityIndicator size="small" color={StitchColors.primary} />
          <Text style={styles.refreshingText}>Updating…</Text>
        </View>
      ) : null}
      {showOverview && overviewLoading ? (
        <LibraryOverviewSkeleton />
      ) : showOverview && overviewData ? (
        <LibraryOverviewCard overview={overviewData} />
      ) : null}

      {showOverview && onCollectionChange ? (
        <SmartCollectionGrid
          counts={overviewData?.collections}
          totalCount={overviewData?.knownWords ?? knownCount}
          selected={selectedCollection ?? null}
          onSelect={onCollectionChange}
        />
      ) : null}

      <View style={styles.filtersTriggerRow}>
        <View
          style={[
            styles.filtersSearchFieldCompact,
            searchFocused && styles.filtersSearchFieldFocused,
            controlsDisabled && styles.buttonDisabled,
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color={StitchColors.outlineVariant}
          />
          <TextInput
            style={styles.filtersSearchInputCompact}
            placeholder="Search your library\u2026"
            placeholderTextColor={`${StitchColors.outlineVariant}99`}
            value={searchQuery}
            onChangeText={onSearchChange}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            returnKeyType="search"
            editable={!controlsDisabled}
          />
        </View>
        <Pressable
          android_ripple={ANDROID_RIPPLE_ICON_ROUND}
          style={({ pressed }) => [
            styles.filtersOpenBtn,
            controlsDisabled && styles.buttonDisabled,
            surfacePressStyle(pressed, false),
          ]}
          hitSlop={HIT_SLOP_MINI}
          onPress={onOpenFilters}
          accessibilityRole="button"
          accessibilityLabel="Filters and sorting"
          disabled={controlsDisabled}
        >
          <Ionicons
            name="options-outline"
            size={22}
            color={StitchColors.primary}
          />
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge} pointerEvents="none">
              <Text style={styles.filterBadgeText}>
                {activeFilterCount > 9 ? "9+" : String(activeFilterCount)}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
});

// ── Main component ───────────────────────────────────────────────────────

export function KnownWordsList({
  knownWords,
  sortPrefs,
  onSortPrefsChange,
  onOpenWord,
  showUnlockEmptyState = false,
  onUnlockPrimaryPress,
  headerTitle = "Library",
  onBackPress,
  backAccessibilityLabel = "Back",
  listHydrating = false,
  effectiveKnownCount,
  suppressGenericEmptyMessage = false,
  libraryLoadError = false,
  overviewData,
  overviewLoading,
  selectedCollection,
  onCollectionChange,
  searchQuery: searchQueryProp = "",
  onSearchQueryChange,
  selectedTiers: selectedTiersProp = [],
  onSelectedTiersChange,
  hasActiveFilters = false,
  refreshing = false,
}: KnownWordsListProps) {
  const [sheetVisible, setSheetVisible] = useState(false);

  const searchQuery = searchQueryProp;
  const selectedTiers = selectedTiersProp;

  const handleSearchChange = useCallback(
    (q: string) => onSearchQueryChange?.(q),
    [onSearchQueryChange],
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (searchQuery.trim()) n += 1;
    n += selectedTiers.length;
    if (sortPrefs.timeOrder !== "newest") n += 1;
    return n;
  }, [searchQuery, selectedTiers, sortPrefs]);

  const applyFilters = useCallback(
    (payload: RevisionFiltersApplyPayload) => {
      onSortPrefsChange(payload.sortPrefs);
      onSelectedTiersChange?.(payload.selectedTiers);
      setSheetVisible(false);
    },
    [onSortPrefsChange, onSelectedTiersChange],
  );

  const openFiltersSheet = useCallback(() => {
    logUserAction("button_press", { target: "library_open_filters_sheet" });
    setSheetVisible(true);
  }, []);

  const listShowsSkeletons =
    listHydrating || (libraryLoadError && knownWords.length === 0);

  const flatData = listShowsSkeletons ? skeletonRowItems(8) : knownWords;

  const headerKnownCount =
    effectiveKnownCount !== undefined
      ? effectiveKnownCount
      : knownWords.length;

  const disableControls = listHydrating || Boolean(showUnlockEmptyState);

  const listHeader = useMemo(
    () => (
      <KnownWordsListHeader
        knownCount={headerKnownCount}
        searchQuery={searchQuery}
        onSearchChange={disableControls ? () => {} : handleSearchChange}
        onOpenFilters={disableControls ? () => {} : openFiltersSheet}
        activeFilterCount={activeFilterCount}
        controlsDisabled={disableControls}
        listHydrating={listHydrating}
        overviewData={overviewData}
        overviewLoading={overviewLoading}
        selectedCollection={selectedCollection}
        onCollectionChange={onCollectionChange}
        refreshing={refreshing}
      />
    ),
    [
      headerKnownCount,
      searchQuery,
      activeFilterCount,
      disableControls,
      handleSearchChange,
      openFiltersSheet,
      listHydrating,
      overviewData,
      overviewLoading,
      selectedCollection,
      onCollectionChange,
      refreshing,
    ],
  );

  const keyExtractor = useCallback((item: VocabularyWord) => item.id, []);

  const renderItem = useCallback(
    (info: ListRenderItemInfo<VocabularyWord>) =>
      info.item.id.startsWith(LIST_SKEL_PREFIX) ? (
        <KnownWordRowSkeleton />
      ) : (
        <LibraryWordRow item={info.item} onPress={onOpenWord} />
      ),
    [onOpenWord],
  );

  const empty = useMemo(() => {
    if (listShowsSkeletons) return null;

    if (showUnlockEmptyState) {
      return (
        <CenteredUnlockCtaCard
          icon="lock-closed-outline"
          title="Your library is empty"
          body="Mark a word as Known in Daily Word \u2014 it will appear here."
          primaryLabel="Go to Daily Word"
          onPrimaryPress={onUnlockPrimaryPress ?? (() => {})}
        />
      );
    }

    if (knownWords.length === 0 && hasActiveFilters) {
      if (selectedCollection && !searchQuery.trim() && selectedTiers.length === 0) {
        return (
          <View style={styles.searchEmpty}>
            <Text style={styles.searchEmptyText}>
              No words in this collection yet.
            </Text>
          </View>
        );
      }
      return (
        <View style={styles.searchEmpty}>
          <Text style={styles.searchEmptyText}>
            {buildEmptyFilterHint(selectedTiers, searchQuery)}
          </Text>
        </View>
      );
    }

    if (knownWords.length === 0) {
      if (suppressGenericEmptyMessage) return null;
      return <KnownWordsListEmpty hasSearch={false} />;
    }

    return null;
  }, [
    knownWords.length,
    searchQuery,
    selectedTiers,
    selectedCollection,
    hasActiveFilters,
    showUnlockEmptyState,
    onUnlockPrimaryPress,
    listShowsSkeletons,
    suppressGenericEmptyMessage,
  ]);

  return (
    <View style={styles.listScreen}>
      <ScreenHeader
        title={headerTitle}
        onBackPress={onBackPress}
        backAccessibilityLabel={
          onBackPress ? backAccessibilityLabel : undefined
        }
      />
      <FlatList
        style={styles.listFlat}
        data={flatData}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={empty}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
      />
      <RevisionFiltersSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onApply={applyFilters}
        initialSortPrefs={sortPrefs}
        initialSelectedTiers={selectedTiers}
        showLevelSections={headerKnownCount > 0 && !listShowsSkeletons}
      />
    </View>
  );
}
