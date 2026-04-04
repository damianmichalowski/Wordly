import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";

import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { CenteredUnlockCtaCard } from "@/src/components/ui/CenteredUnlockCtaCard";
import { TransportRetryMessage } from "@/src/components/ui/TransportRetryMessage";
import {
  STUCK_LOADING_MS,
  useStuckLoading,
} from "@/src/hooks/useStuckLoading";
import {
  ANDROID_RIPPLE_ICON_ROUND,
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  HIT_SLOP_MINI,
  primarySolidPressStyle,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import {
  RevisionFiltersSheet,
  type RevisionFiltersApplyPayload,
} from "@/src/features/revision/components/RevisionFiltersSheet";
import { revisionScreenStyles as styles } from "@/src/features/revision/revisionScreenStyles";
import {
  LIBRARY_TIER_CEFR_LEVELS,
  LIBRARY_TIER_LABEL,
  type CefrLevel,
  type LibraryLevelTier,
} from "@/src/types/cefr";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import { logUserAction } from "@/src/utils/userActionLog";
import {
  vocabularyWordDisplayTargetText,
  type VocabularyWord,
} from "@/src/types/words";

import type {
  RevisionSortPrefs,
  RevisionTimeOrder,
} from "@/src/services/revision/revisionSortPrefs";

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
  /**
   * Gdy `true` — serwer potwierdził 0 znanych słów (nie samo `knownWords.length` zanim zsynchronizuje się z query).
   * Parent musi ustawić to tylko po rozstrzygniętym fetchu biblioteki.
   */
  showUnlockEmptyState?: boolean;
  onUnlockPrimaryPress?: () => void;
  /** Domyślnie „Biblioteka”. */
  headerTitle?: string;
  onBackPress?: () => void;
  backAccessibilityLabel?: string;
  /** Pierwszy fetch biblioteki — wiersze-szkielety zamiast pustego ekranu ze spinnerem. */
  listHydrating?: boolean;
  /**
   * Biblioteka: licznik z odpowiedzi query (`libraryQuery.data.length`), nie `knownWords.length` przed sync.
   */
  effectiveKnownCount?: number;
  /**
   * Biblioteka: nie pokazuj ogólnego „Jeszcze brak słów” — potwierdzone pusto obsługuje unlock CTA;
   * nierozstrzygnięty / błąd nie powinien udawać pustej listy.
   */
  suppressGenericEmptyMessage?: boolean;
  /** Biblioteka: pierwszy fetch zakończony błędem — pokaż komunikat + retry zamiast pustej listy. */
  libraryLoadError?: boolean;
  /** Spinner przy retry / refetch biblioteki (błąd lub „stuck” loading). */
  libraryFetchBusy?: boolean;
  onRetryLibrary?: () => void;
};

function formatTiersList(tiers: LibraryLevelTier[]): string {
  return [...tiers]
    .map((t) => LIBRARY_TIER_LABEL[t])
    .join(", ");
}

function buildEmptyFilterHint(
  selectedTiers: LibraryLevelTier[],
  q: string,
): string {
  const qTrim = q.trim();
  const tiersLabel = formatTiersList(selectedTiers);
  if (selectedTiers.length > 0 && qTrim) {
    return `Brak wyników: ${tiersLabel}, fraza „${qTrim}”`;
  }
  if (selectedTiers.length > 0) {
    return `Brak słów dla wybranych poziomów (${tiersLabel})`;
  }
  return `Brak wyników dla „${qTrim}”`;
}

function tiersToCefrSet(tiers: LibraryLevelTier[]): Set<CefrLevel> {
  const set = new Set<CefrLevel>();
  for (const t of tiers) {
    for (const lvl of LIBRARY_TIER_CEFR_LEVELS[t]) {
      set.add(lvl);
    }
  }
  return set;
}

/** Kolejność wg `known_at`: najnowsze = malejąco, najstarsze = rosnąco; bez daty na końcu. */
function sortWordsByKnownAt(
  list: VocabularyWord[],
  timeOrder: RevisionTimeOrder,
): VocabularyWord[] {
  const newestFirst = timeOrder === "newest";
  return [...list].sort((a, b) => {
    const ta = a.knownAt ? Date.parse(a.knownAt) : NaN;
    const tb = b.knownAt ? Date.parse(b.knownAt) : NaN;
    const aOk = Number.isFinite(ta);
    const bOk = Number.isFinite(tb);
    if (aOk && bOk && ta !== tb) {
      return newestFirst ? tb - ta : ta - tb;
    }
    if (aOk !== bOk) {
      return aOk ? -1 : 1;
    }
    return a.sourceText.localeCompare(b.sourceText, undefined, {
      sensitivity: "base",
    });
  });
}

/** Poza komponentem listy (stabilna referencja dla `ListEmptyComponent`). */
function KnownWordsListEmpty({ hasSearch }: { hasSearch: boolean }) {
  return (
    <View style={styles.emptyList}>
      <Text style={styles.title}>
        {hasSearch ? "Brak wyników" : "Jeszcze brak słów"}
      </Text>
      <Text style={styles.subtitle}>
        {hasSearch
          ? "Spróbuj innej frazy w wyszukiwarce."
          : "Oznaczaj słowa jako „Known” w Daily. Pojawią się tutaj."}
      </Text>
    </View>
  );
}

const KnownWordRow = memo(function KnownWordRow({
  item,
  onOpenWord,
}: {
  item: VocabularyWord;
  onOpenWord: (word: VocabularyWord) => void;
}) {
  return (
    <Pressable
      android_ripple={ANDROID_RIPPLE_SURFACE}
      style={({ pressed }) => [
        styles.rowCard,
        surfacePressStyle(pressed, false),
      ]}
      onPress={() => onOpenWord(item)}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowWord} numberOfLines={1}>
          {item.sourceText}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={22}
        color={StitchColors.outlineVariant}
        style={styles.rowChevron}
      />
    </Pressable>
  );
});

type KnownWordsListHeaderProps = {
  knownCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
  controlsDisabled?: boolean;
  listHydrating?: boolean;
};

const KnownWordsListHeader = memo(function KnownWordsListHeader({
  knownCount,
  searchQuery,
  onSearchChange,
  onOpenFilters,
  activeFilterCount,
  controlsDisabled = false,
  listHydrating = false,
}: KnownWordsListHeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const statsLine = listHydrating
    ? "Wczytuję bibliotekę…"
    : knownCount === 1
      ? "1 słowo w bibliotece"
      : `${knownCount} słów w bibliotece`;

  return (
    <View style={styles.listHeaderBlock}>
      <Text style={styles.libraryStats}>{statsLine}</Text>

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
            placeholder="Szukaj w bibliotece…"
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
          accessibilityLabel="Filtry i sortowanie"
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

      <Text style={styles.sectionRecentLabel}>Ostatnie słowa</Text>
    </View>
  );
});

/**
 * Lista znanych słów (zakładka Biblioteka).
 * Style filtrów w `revisionScreenStyles` (współdzielone z modułem rewizji).
 */
export function KnownWordsList({
  knownWords,
  sortPrefs,
  onSortPrefsChange,
  onOpenWord,
  showUnlockEmptyState = false,
  onUnlockPrimaryPress,
  headerTitle = "Biblioteka",
  onBackPress,
  backAccessibilityLabel = "Wróć",
  listHydrating = false,
  effectiveKnownCount,
  suppressGenericEmptyMessage = false,
  libraryLoadError = false,
  libraryFetchBusy = false,
  onRetryLibrary,
}: KnownWordsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTiers, setSelectedTiers] = useState<LibraryLevelTier[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);

  const stuckHydrating = useStuckLoading(
    listHydrating && !libraryLoadError,
    STUCK_LOADING_MS,
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (searchQuery.trim()) {
      n += 1;
    }
    n += selectedTiers.length;
    if (sortPrefs.timeOrder !== "newest") {
      n += 1;
    }
    return n;
  }, [searchQuery, selectedTiers, sortPrefs]);

  const applyFilters = useCallback(
    (payload: RevisionFiltersApplyPayload) => {
      onSortPrefsChange(payload.sortPrefs);
      setSelectedTiers(payload.selectedTiers);
      setSheetVisible(false);
    },
    [onSortPrefsChange],
  );

  const openFiltersSheet = useCallback(() => {
    logUserAction("button_press", { target: "library_open_filters_sheet" });
    setSheetVisible(true);
  }, []);

  const filteredWords = useMemo(() => {
    let list = knownWords;
    if (selectedTiers.length > 0) {
      const set = tiersToCefrSet(selectedTiers);
      list = list.filter((w) => set.has(w.cefrLevel as CefrLevel));
    }
    const q = searchQuery.trim().toLowerCase();
    const filtered = !q
      ? list
      : list.filter((w) => {
          const s = w.sourceText.toLowerCase();
          const t = vocabularyWordDisplayTargetText(w).toLowerCase();
          return s.includes(q) || t.includes(q);
        });
    return sortWordsByKnownAt(filtered, sortPrefs.timeOrder);
  }, [knownWords, searchQuery, selectedTiers, sortPrefs.timeOrder]);

  const listShowsSkeletons = listHydrating && !stuckHydrating;
  const flatData = listShowsSkeletons
    ? skeletonRowItems(8)
    : filteredWords;

  const headerKnownCount =
    effectiveKnownCount !== undefined
      ? effectiveKnownCount
      : knownWords.length;

  const disableControls =
    listHydrating ||
    Boolean(showUnlockEmptyState);

  const listHeader = useMemo(
    () => (
      <KnownWordsListHeader
        knownCount={headerKnownCount}
        searchQuery={searchQuery}
        onSearchChange={disableControls ? () => {} : setSearchQuery}
        onOpenFilters={disableControls ? () => {} : openFiltersSheet}
        activeFilterCount={activeFilterCount}
        controlsDisabled={disableControls}
        listHydrating={listHydrating}
      />
    ),
    [
      headerKnownCount,
      searchQuery,
      activeFilterCount,
      disableControls,
      openFiltersSheet,
      listHydrating,
    ],
  );

  const keyExtractor = useCallback((item: VocabularyWord) => item.id, []);

  const renderItem = useCallback(
    (info: ListRenderItemInfo<VocabularyWord>) =>
      info.item.id.startsWith(LIST_SKEL_PREFIX) ? (
        <KnownWordRowSkeleton />
      ) : (
        <KnownWordRow item={info.item} onOpenWord={onOpenWord} />
      ),
    [onOpenWord],
  );

  const empty = useMemo(() => {
    if (listShowsSkeletons) {
      return null;
    }
    if (stuckHydrating && onRetryLibrary) {
      return (
        <TransportRetryMessage
          variant="embedded"
          isRetrying={libraryFetchBusy}
          onRetry={onRetryLibrary}
        />
      );
    }
    if (libraryLoadError && onRetryLibrary) {
      return (
        <TransportRetryMessage
          variant="embedded"
          isRetrying={libraryFetchBusy}
          onRetry={onRetryLibrary}
        />
      );
    }
    if (showUnlockEmptyState) {
      return (
        <CenteredUnlockCtaCard
          icon="lock-closed-outline"
          title="Twoja biblioteka jest pusta"
          body="Oznacz słowo jako „Known” w Daily Word — wtedy pojawi się tutaj."
          primaryLabel="Przejdź do Daily Word"
          onPrimaryPress={onUnlockPrimaryPress ?? (() => {})}
        />
      );
    }
    if (knownWords.length === 0) {
      if (suppressGenericEmptyMessage) {
        return null;
      }
      return <KnownWordsListEmpty hasSearch={false} />;
    }
    if (filteredWords.length === 0) {
      return (
        <View style={styles.searchEmpty}>
          <Text style={styles.searchEmptyText}>
            {buildEmptyFilterHint(selectedTiers, searchQuery)}
          </Text>
        </View>
      );
    }
    return null;
  }, [
    knownWords.length,
    filteredWords.length,
    searchQuery,
    selectedTiers,
    showUnlockEmptyState,
    onUnlockPrimaryPress,
    listShowsSkeletons,
    suppressGenericEmptyMessage,
    stuckHydrating,
    libraryLoadError,
    libraryFetchBusy,
    onRetryLibrary,
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
      />
      <RevisionFiltersSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onApply={applyFilters}
        initialSortPrefs={sortPrefs}
        initialSelectedTiers={selectedTiers}
        showLevelSections={headerKnownCount > 0 && !listHydrating}
      />
    </View>
  );
}
