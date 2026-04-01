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
import {
  ANDROID_RIPPLE_ICON_ROUND,
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  HIT_SLOP_MINI,
  primarySolidPressStyle,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import {
  LIBRARY_TIER_CEFR_LEVELS,
  LIBRARY_TIER_LABEL,
  type CefrLevel,
  type LibraryLevelTier,
} from "@/src/types/cefr";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import {
  vocabularyWordDisplayTargetText,
  type VocabularyWord,
} from "@/src/types/words";

import type {
  RevisionSortPrefs,
  RevisionTimeOrder,
} from "@/src/services/revision/revisionSortPrefs";

import {
  RevisionFiltersSheet,
  type RevisionFiltersApplyPayload,
} from "@/src/features/revision/components/RevisionFiltersSheet";
import { revisionScreenStyles as styles } from "../revisionScreenStyles";

type RevisionKnownWordsListProps = {
  knownWords: VocabularyWord[];
  sortPrefs: RevisionSortPrefs;
  onSortPrefsChange: (prefs: RevisionSortPrefs) => void;
  onStartFlashcards: () => void;
  onOpenWord: (word: VocabularyWord) => void;
  /** Gdy `true` i lista jest pusta (0 słów), pokazuje „unlock” jako empty state i blokuje wyszukiwarkę/filtry. */
  showUnlockEmptyState?: boolean;
  onUnlockPrimaryPress?: () => void;
  /** Domyślnie „Biblioteka”; w sesji np. tytuł trybu. */
  headerTitle?: string;
  onBackPress?: () => void;
  /** Lista z wybranego trybu (nie pełna biblioteka). */
  sessionVariant?: boolean;
  /** Wejście do centrum trybów (Stitch), tylko przy zwykłej bibliotece. */
  onOpenRevisionHub?: () => void;
  backAccessibilityLabel?: string;
  /** Kafel „Ćwicz fiszki”; wyłącz np. w zakładce Szukaj (powtórka z Revision Hub). */
  showFlashcardHero?: boolean;
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
function RevisionListEmpty({ hasSearch }: { hasSearch: boolean }) {
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

const RevisionKnownWordRow = memo(function RevisionKnownWordRow({
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

type RevisionListHeaderProps = {
  knownCount: number;
  sessionVariant: boolean;
  showFlashcardHero: boolean;
  onStartFlashcards: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
  controlsDisabled?: boolean;
};

const RevisionListHeader = memo(function RevisionListHeader({
  knownCount,
  sessionVariant,
  showFlashcardHero,
  onStartFlashcards,
  searchQuery,
  onSearchChange,
  onOpenFilters,
  activeFilterCount,
  controlsDisabled = false,
}: RevisionListHeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const statsLine = sessionVariant
    ? knownCount === 1
      ? "1 słowo w tej sesji"
      : `${knownCount} słów w tej sesji`
    : knownCount === 1
      ? "1 słowo w bibliotece"
      : `${knownCount} słów w bibliotece`;

  const ctaSubtitle =
    knownCount === 1
      ? "1 słowo w kolejce"
      : `${knownCount} słów w kolejce`;

  return (
    <View style={styles.listHeaderBlock}>
      <Text style={styles.libraryStats}>{statsLine}</Text>

      {showFlashcardHero && knownCount > 0 ? (
        <Pressable
          android_ripple={ANDROID_RIPPLE_PRIMARY}
          style={({ pressed }) => [
            styles.heroCta,
            primarySolidPressStyle(pressed, false),
          ]}
          onPress={onStartFlashcards}
        >
          <View style={styles.heroCtaDecor} pointerEvents="none" />
          <View style={styles.heroCtaInner}>
            <View style={styles.heroCtaBadgeRow}>
              <View style={styles.heroCtaIconWrap}>
                <Ionicons
                  name="color-palette"
                  size={22}
                  color={StitchColors.onPrimary}
                />
              </View>
              <Text style={styles.heroCtaKicker}>Gotowe do powtórki</Text>
            </View>
            <Text style={styles.heroCtaTitle}>Ćwicz fiszki</Text>
            <Text style={styles.heroCtaSubtitle}>{ctaSubtitle}</Text>
          </View>
        </Pressable>
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
            placeholder={
              sessionVariant ? "Szukaj na liście…" : "Szukaj w bibliotece…"
            }
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

      <Text style={styles.sectionRecentLabel}>
        {sessionVariant ? "Lista słów" : "Ostatnie słowa"}
      </Text>
    </View>
  );
});

export function RevisionKnownWordsList({
  knownWords,
  sortPrefs,
  onSortPrefsChange,
  onStartFlashcards,
  onOpenWord,
  showUnlockEmptyState = false,
  onUnlockPrimaryPress,
  headerTitle = "Biblioteka",
  onBackPress,
  sessionVariant = false,
  showFlashcardHero = true,
  backAccessibilityLabel = "Wróć do Revision Hub",
}: RevisionKnownWordsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTiers, setSelectedTiers] = useState<LibraryLevelTier[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);

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

  const disableControls = showUnlockEmptyState && knownWords.length === 0;

  const listHeader = useMemo(
    () => (
      <RevisionListHeader
        knownCount={knownWords.length}
        sessionVariant={sessionVariant}
        showFlashcardHero={showFlashcardHero}
        onStartFlashcards={onStartFlashcards}
        searchQuery={searchQuery}
        onSearchChange={disableControls ? () => {} : setSearchQuery}
        onOpenFilters={disableControls ? () => {} : () => setSheetVisible(true)}
        activeFilterCount={activeFilterCount}
        controlsDisabled={disableControls}
      />
    ),
    [
      knownWords.length,
      sessionVariant,
      showFlashcardHero,
      onStartFlashcards,
      searchQuery,
      activeFilterCount,
      disableControls,
    ],
  );

  const keyExtractor = useCallback((item: VocabularyWord) => item.id, []);

  const renderItem = useCallback(
    (info: ListRenderItemInfo<VocabularyWord>) => (
      <RevisionKnownWordRow item={info.item} onOpenWord={onOpenWord} />
    ),
    [onOpenWord],
  );

  const empty = useMemo(() => {
    if (knownWords.length === 0) {
      if (showUnlockEmptyState) {
        return (
          <CenteredUnlockCtaCard
            icon="lock-closed-outline"
            title="Twoja biblioteka jest pusta"
            body="Oznacz słowo jako „Known” w Daily Word, a pojawi się tutaj. Wtedy odblokujesz też tryby powtórek."
            primaryLabel="Przejdź do Daily Word"
            onPrimaryPress={onUnlockPrimaryPress ?? (() => {})}
          />
        );
      }
      return <RevisionListEmpty hasSearch={false} />;
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
        data={filteredWords}
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
        showLevelSections={knownWords.length > 0}
      />
    </View>
  );
}
