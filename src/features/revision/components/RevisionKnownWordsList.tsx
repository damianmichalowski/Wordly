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
import {
  ANDROID_RIPPLE_ICON_ROUND,
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  HIT_SLOP_MINI,
  primarySolidPressStyle,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import { cefrLevels, type CefrLevel } from "@/src/types/cefr";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import {
  vocabularyWordDisplayTargetText,
  type VocabularyWord,
} from "@/src/types/words";

import type { RevisionSortPrefs } from "@/src/services/revision/revisionSortPrefs";

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

/**
 * A1/A2: szare; B1/B2: niebieski; C1/C2: zielony (jaśniejszy / ciemniejszy w parze).
 */
const CEFR_PILL: Record<CefrLevel, { bg: string; fg: string }> = {
  A1: { bg: "#F2F3F5", fg: "#5B6061" },
  A2: { bg: "#D8DCDE", fg: "#2F3334" },
  B1: { bg: "#E4E9FF", fg: "#2F46B8" },
  B2: { bg: "#C9D4FA", fg: "#1A237E" },
  C1: { bg: "#E8F5E9", fg: "#2E7D32" },
  C2: { bg: "#C8E6C9", fg: "#1B5E20" },
};

function cefrPillStyle(level: string): { bg: string; fg: string } {
  return (
    CEFR_PILL[level as CefrLevel] ?? {
      bg: StitchColors.surfaceContainerHigh,
      fg: StitchColors.onSurfaceVariant,
    }
  );
}

function formatLevelsList(levels: CefrLevel[]): string {
  return [...levels]
    .sort((a, b) => cefrLevels.indexOf(a) - cefrLevels.indexOf(b))
    .join(", ");
}

function buildEmptyFilterHint(selectedLevels: CefrLevel[], q: string): string {
  const qTrim = q.trim();
  const levelsLabel = formatLevelsList(selectedLevels);
  if (selectedLevels.length > 0 && qTrim) {
    return `Brak wyników: poziomy ${levelsLabel}, fraza „${qTrim}”`;
  }
  if (selectedLevels.length > 0) {
    return `Brak słów dla wybranych poziomów (${levelsLabel})`;
  }
  return `Brak wyników dla „${qTrim}”`;
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
  const levelColors = cefrPillStyle(item.cefrLevel);

  return (
    <Pressable
      android_ripple={ANDROID_RIPPLE_SURFACE}
      style={({ pressed }) => [
        styles.rowCard,
        surfacePressStyle(pressed, false),
      ]}
      onPress={() => onOpenWord(item)}
    >
      <View style={styles.rowLevelCol}>
        <View style={[styles.rowCefrPill, { backgroundColor: levelColors.bg }]}>
          <Text style={[styles.rowCefrPillText, { color: levelColors.fg }]}>
            {item.cefrLevel}
          </Text>
        </View>
      </View>
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
          />
        </View>
        <Pressable
          android_ripple={ANDROID_RIPPLE_ICON_ROUND}
          style={({ pressed }) => [
            styles.filtersOpenBtn,
            surfacePressStyle(pressed, false),
          ]}
          hitSlop={HIT_SLOP_MINI}
          onPress={onOpenFilters}
          accessibilityRole="button"
          accessibilityLabel="Filtry i sortowanie"
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
  headerTitle = "Biblioteka",
  onBackPress,
  sessionVariant = false,
  showFlashcardHero = true,
  backAccessibilityLabel = "Wróć do Revision Hub",
}: RevisionKnownWordsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<CefrLevel[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (searchQuery.trim()) {
      n += 1;
    }
    n += selectedLevels.length;
    if (sortPrefs.timeOrder !== "newest") {
      n += 1;
    }
    if (sortPrefs.cefrOrder !== "none") {
      n += 1;
    }
    return n;
  }, [searchQuery, selectedLevels, sortPrefs]);

  const applyFilters = useCallback(
    (payload: RevisionFiltersApplyPayload) => {
      onSortPrefsChange(payload.sortPrefs);
      setSelectedLevels(payload.selectedLevels);
      setSheetVisible(false);
    },
    [onSortPrefsChange],
  );

  const filteredWords = useMemo(() => {
    let list = knownWords;
    if (selectedLevels.length > 0) {
      const set = new Set(selectedLevels);
      list = list.filter((w) => set.has(w.cefrLevel));
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter((w) => {
      const s = w.sourceText.toLowerCase();
      const t = vocabularyWordDisplayTargetText(w).toLowerCase();
      return s.includes(q) || t.includes(q);
    });
  }, [knownWords, searchQuery, selectedLevels]);

  const listHeader = useMemo(
    () => (
      <RevisionListHeader
        knownCount={knownWords.length}
        sessionVariant={sessionVariant}
        showFlashcardHero={showFlashcardHero}
        onStartFlashcards={onStartFlashcards}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenFilters={() => setSheetVisible(true)}
        activeFilterCount={activeFilterCount}
      />
    ),
    [
      knownWords.length,
      sessionVariant,
      showFlashcardHero,
      onStartFlashcards,
      searchQuery,
      activeFilterCount,
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
      return <RevisionListEmpty hasSearch={false} />;
    }
    if (filteredWords.length === 0) {
      return (
        <View style={styles.searchEmpty}>
          <Text style={styles.searchEmptyText}>
            {buildEmptyFilterHint(selectedLevels, searchQuery)}
          </Text>
        </View>
      );
    }
    return null;
  }, [knownWords.length, filteredWords.length, searchQuery, selectedLevels]);

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
        initialSelectedLevels={selectedLevels}
        showLevelSections={knownWords.length > 0}
      />
    </View>
  );
}
