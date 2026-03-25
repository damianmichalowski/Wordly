import { Ionicons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import {
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  primarySolidPressStyle,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import { cefrLevels, type CefrLevel } from "@/src/types/cefr";
import type { RevisionSessionConfig } from "@/src/types/revisionSession";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";

import { revisionScreenStyles as styles } from "../revisionScreenStyles";

export type RevisionHubCounts = {
  daily: number;
  difficult: number;
  recent: number;
  all: number;
  levelPreview: number;
  /** Liczba znanych słów na poziom CEFR (Level Practice). */
  levelCounts: Record<CefrLevel, number>;
};

type RevisionHubProps = {
  knownTotal: number;
  counts: RevisionHubCounts;
  defaultLevel: CefrLevel;
  onSelectSession: (config: RevisionSessionConfig) => void;
  /** Gdy brak: zakładka Revision Hub (bez cofania do biblioteki). */
  onBackToLibrary?: () => void;
};

const QUICK_SIZES = [5, 10, 20] as const;

/** Siatka 2×3 w modalu Level Practice. */
const LEVEL_GRID_ROWS: CefrLevel[][] = [
  cefrLevels.slice(0, 2),
  cefrLevels.slice(2, 4),
  cefrLevels.slice(4, 6),
];

type HubIntroSheet =
  | { type: "daily" }
  | { type: "quick" }
  | { type: "difficult" }
  | { type: "recent" }
  | { type: "level" };

function getHubIntro(
  sheet: HubIntroSheet,
  counts: RevisionHubCounts,
  defaultLevel: CefrLevel,
): { title: string; subtitle?: string; body: string } {
  switch (sheet.type) {
    case "daily":
      return {
        title: "Daily Review",
        subtitle:
          counts.daily === 1
            ? "1 word ready today"
            : `${counts.daily} words ready today`,
        body:
          "This is the main revision mode and the best place to start each day.\n\n" +
          "It only includes words that are due for review today, not a random mix from your whole library. " +
          "You work through what the schedule says is ready now.\n\n" +
          "Behind simple time gaps: when you remember a word easily, the next review can move further out; " +
          "when it is harder, it comes back sooner. That keeps the daily batch meaningful and manageable.\n\n" +
          "Use Daily Review as your default routine for staying on top of vocabulary.",
      };
    case "quick":
      return {
        title: "Quick Practice",
        subtitle: "Short session",
        body:
          "A rapid-fire session. Choose how many words to include, then start.",
      };
    case "difficult":
      return {
        title: "Difficult Words",
        subtitle: `${counts.difficult} words`,
        body:
          "This mode is built around words that still give you trouble, not a mix with everything you already know well.\n\n" +
          "Words you struggle to recall in other sessions, or that the system treats as harder to remember, " +
          "are grouped here so you can attack them in one place.\n\n" +
          "You drill the weak spots directly instead of diluting them with easy items. " +
          "That keeps practice honest and makes progress feel real.",
      };
    case "recent":
      return {
        title: "Recently Learned",
        subtitle: `${counts.recent} items`,
        body:
          "This mode targets vocabulary you have marked known fairly recently, so you can reinforce it while it is still fresh.\n\n" +
          "The list prefers words from roughly the last seven days. " +
          "If there are few or none in that window, it fills from your most recently added known words up to a cap. " +
          "That gives you a compact, up-to-date set instead of your whole library.\n\n" +
          "New items are the easiest to forget. Use this alongside your usual schedule to lock in what you just learned, " +
          "before spaced repetition alone would bring it back.",
      };
    case "level":
      return {
        title: "Level Practice",
        subtitle: `Default ${defaultLevel}`,
        body:
          "Filter revision by CEFR level. Pick a level below. Each option starts its own session.",
      };
  }
}

export function RevisionHub({
  knownTotal,
  counts,
  defaultLevel,
  onSelectSession,
  onBackToLibrary,
}: RevisionHubProps) {
  const [sheet, setSheet] = useState<HubIntroSheet | null>(null);
  const [quickCount, setQuickCount] = useState<5 | 10 | 20>(10);
  const insets = useSafeAreaInsets();
  const canPractice = knownTotal > 0;

  const dailyLabel =
    counts.daily === 1 ? "1 word ready" : `${counts.daily} words ready`;

  const openSheet = useCallback((next: HubIntroSheet) => {
    setSheet(next);
  }, []);

  const closeSheet = useCallback(() => {
    setSheet(null);
  }, []);

  const commitSession = useCallback(() => {
    if (!sheet || sheet.type === "level") {
      return;
    }
    if (sheet.type === "quick") {
      if (!canPractice) {
        return;
      }
      onSelectSession({ kind: "quick", count: quickCount });
    } else if (sheet.type === "daily") {
      onSelectSession({ kind: "daily" });
    } else if (sheet.type === "difficult") {
      onSelectSession({ kind: "difficult" });
    } else if (sheet.type === "recent") {
      onSelectSession({ kind: "recent" });
    }
    setSheet(null);
  }, [sheet, quickCount, canPractice, onSelectSession]);

  const openQuickSheet = useCallback((count?: 5 | 10 | 20) => {
    if (count !== undefined) {
      setQuickCount(count);
    } else {
      setQuickCount(10);
    }
    setSheet({ type: "quick" });
  }, []);

  const intro =
    sheet === null ? null : getHubIntro(sheet, counts, defaultLevel);

  return (
    <View style={styles.listScreen}>
      <ScreenHeader
        title="Revision Hub"
        {...(onBackToLibrary
          ? {
              onBackPress: onBackToLibrary,
              backAccessibilityLabel: "Wróć do biblioteki",
            }
          : {})}
      />
      <ScrollView
        style={styles.hubScroll}
        contentContainerStyle={[
          styles.hubScrollContent,
          { paddingBottom: Math.max(32, insets.bottom + 24) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hubBentoWrap}>
          <View style={styles.hubTileFull}>
            <Pressable
              android_ripple={ANDROID_RIPPLE_SURFACE}
              style={({ pressed }) => [
                styles.hubCardWhite,
                styles.hubDailyFeatured,
                surfacePressStyle(pressed, false),
              ]}
              onPress={() => openSheet({ type: "daily" })}
              accessibilityRole="button"
              accessibilityLabel="Daily Review"
            >
              <View style={styles.hubDailyIconDecor} pointerEvents="none">
                <MaterialIcons
                  name="psychology"
                  size={112}
                  color={StitchColors.primary}
                />
              </View>
              <View style={styles.hubDailyTextBlock}>
                <Text style={styles.hubDailyCardTitle}>Daily Review</Text>
                <Text style={styles.hubDailyDesc}>
                  Personalized spaced repetition focusing on words that need
                  reinforcement today.
                </Text>
              </View>
              <View style={styles.hubDailyMetaRow}>
                <Text style={styles.hubSmallMetaText}>{dailyLabel}</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={StitchColors.onSurfaceVariant}
                />
              </View>
            </Pressable>
          </View>

          <View style={styles.hubTileFull}>
            <Pressable
              android_ripple={ANDROID_RIPPLE_SURFACE}
              style={({ pressed }) => [
                styles.hubCardWhite,
                surfacePressStyle(pressed, false),
              ]}
              onPress={() => openQuickSheet()}
              accessibilityRole="button"
              accessibilityLabel="Quick Practice"
            >
              <View
                style={[
                  styles.hubIconCircle,
                  { backgroundColor: `${StitchColors.primary}18` },
                ]}
              >
                <MaterialIcons
                  name="timer"
                  size={26}
                  color={StitchColors.primary}
                />
              </View>
              <Text style={styles.hubCardTitleSm}>Quick Practice</Text>
              <Text style={styles.hubCardDescSm}>
                A rapid-fire session. Choose 5, 10, or 20 words for a quick
                mental spark.
              </Text>
              <View style={styles.hubSmallMetaRow}>
                <Text style={styles.hubSmallMetaText}>5 to 20 words</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={StitchColors.onSurfaceVariant}
                />
              </View>
            </Pressable>
          </View>

          <View style={styles.hubTileFull}>
            <Pressable
              android_ripple={ANDROID_RIPPLE_SURFACE}
              style={({ pressed }) => [
                styles.hubCardWhite,
                surfacePressStyle(pressed, false),
              ]}
              onPress={() => openSheet({ type: "difficult" })}
            >
              <View
                style={[
                  styles.hubIconCircle,
                  { backgroundColor: "rgba(168, 54, 75, 0.12)" },
                ]}
              >
                <MaterialIcons name="priority-high" size={26} color="#A8364B" />
              </View>
              <Text style={styles.hubCardTitleSm}>Difficult Words</Text>
              <Text style={styles.hubCardDescSm}>
                Conquer the words that challenge you most. Focus on
                low-mastery vocabulary.
              </Text>
              <View style={styles.hubSmallMetaRow}>
                <Text style={styles.hubSmallMetaText}>
                  {counts.difficult} words
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={StitchColors.onSurfaceVariant}
                />
              </View>
            </Pressable>
          </View>

          <View style={styles.hubTileFull}>
            <Pressable
              android_ripple={ANDROID_RIPPLE_SURFACE}
              style={({ pressed }) => [
                styles.hubCardWhite,
                surfacePressStyle(pressed, false),
              ]}
              onPress={() => openSheet({ type: "recent" })}
            >
              <View
                style={[
                  styles.hubIconCircle,
                  { backgroundColor: "rgba(40, 108, 52, 0.12)" },
                ]}
              >
                <MaterialIcons
                  name="new-releases"
                  size={26}
                  color="#286C34"
                />
              </View>
              <Text style={styles.hubCardTitleSm}>Recently Learned</Text>
              <Text style={styles.hubCardDescSm}>
                Reinforce new concepts from the last 7 days to ensure long-term
                retention.
              </Text>
              <View style={styles.hubSmallMetaRow}>
                <Text style={styles.hubSmallMetaText}>
                  {counts.recent} items
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={StitchColors.onSurfaceVariant}
                />
              </View>
            </Pressable>
          </View>

          <View style={styles.hubTileFull}>
            <Pressable
              android_ripple={ANDROID_RIPPLE_SURFACE}
              style={({ pressed }) => [
                styles.hubCardWhite,
                surfacePressStyle(pressed, false),
              ]}
              onPress={() => openSheet({ type: "level" })}
              accessibilityRole="button"
              accessibilityLabel="Level Practice"
            >
              <View
                style={[
                  styles.hubIconCircle,
                  { backgroundColor: `${StitchColors.primary}18` },
                ]}
              >
                <MaterialIcons
                  name="bar-chart"
                  size={26}
                  color={StitchColors.primary}
                />
              </View>
              <Text style={styles.hubCardTitleSm}>Level Practice</Text>
              <Text style={styles.hubCardDescSm}>
                Filter your revision by CEFR level.
              </Text>
              <View
                style={[
                  styles.hubSmallMetaRow,
                  counts.levelPreview === 0 && styles.hubSmallMetaRowEnd,
                ]}
              >
                {counts.levelPreview > 0 ? (
                  <Text style={styles.hubSmallMetaText}>
                    {counts.levelPreview === 1
                      ? "1 word"
                      : `${counts.levelPreview} words`}
                  </Text>
                ) : null}
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={StitchColors.onSurfaceVariant}
                />
              </View>
            </Pressable>
          </View>

          <View style={[styles.hubTileFull, styles.hubAchievement]}>
            <View>
              <Text style={styles.hubAchievementTitle}>Steady Progress</Text>
              <Text style={styles.hubAchievementDesc}>
                Ćwicz regularnie. Kolejne statystyki pojawią się tutaj.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={sheet !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeSheet}
      >
        <View style={styles.listScreen}>
          {intro ? (
            <>
              <ScreenHeader
                title={intro.title}
                subtitle={intro.subtitle}
                onBackPress={closeSheet}
              />
              <ScrollView
                style={styles.hubScroll}
                contentContainerStyle={[
                  styles.hubScrollContent,
                  styles.hubSessionSheetBody,
                  { paddingBottom: Math.max(32, insets.bottom + 24) },
                ]}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.hubSessionIntro}>{intro.body}</Text>

                {sheet?.type === "quick" ? (
                  <>
                    <View style={styles.hubQuickRow}>
                      {QUICK_SIZES.map((n) => (
                        <Pressable
                          key={n}
                          android_ripple={ANDROID_RIPPLE_SURFACE}
                          style={({ pressed }) => [
                            styles.hubQuickSegment,
                            quickCount === n && styles.hubQuickSegmentSelected,
                            !canPractice && styles.buttonDisabled,
                            surfacePressStyle(pressed, !canPractice),
                          ]}
                          disabled={!canPractice}
                          onPress={() => setQuickCount(n)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: quickCount === n }}
                          accessibilityLabel={`${n} words`}
                        >
                          <Text
                            style={[
                              styles.hubQuickSegmentValue,
                              quickCount === n &&
                                styles.hubQuickSegmentValueSelected,
                            ]}
                          >
                            {n}
                          </Text>
                          <Text
                            style={[
                              styles.hubQuickSegmentUnit,
                              quickCount === n &&
                                styles.hubQuickSegmentUnitSelected,
                            ]}
                          >
                            words
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable
                      android_ripple={ANDROID_RIPPLE_PRIMARY}
                      style={({ pressed }) => [
                        styles.hubStartSessionBtn,
                        styles.hubSessionSheetPrimary,
                        !canPractice && styles.buttonDisabled,
                        primarySolidPressStyle(pressed, !canPractice),
                      ]}
                      disabled={!canPractice}
                      onPress={commitSession}
                      accessibilityRole="button"
                      accessibilityLabel="Start session"
                    >
                      <Text style={styles.hubStartSessionBtnText}>
                        Start Session
                      </Text>
                    </Pressable>
                  </>
                ) : null}

                {sheet?.type === "level" ? (
                  <View style={styles.hubLevelGrid}>
                    {LEVEL_GRID_ROWS.map((row, rowIndex) => (
                      <View
                        key={`row-${rowIndex}`}
                        style={styles.hubLevelGridRow}
                      >
                        {row.map((level) => {
                          const n = counts.levelCounts[level];
                          const disabled = n === 0;
                          return (
                            <Pressable
                              key={level}
                              android_ripple={ANDROID_RIPPLE_SURFACE}
                              style={({ pressed }) => [
                                styles.hubLevelGridCell,
                                disabled && styles.hubLevelGridCellDisabled,
                                surfacePressStyle(pressed, disabled),
                              ]}
                              disabled={disabled}
                              onPress={() => {
                                closeSheet();
                                onSelectSession({ kind: "level", level });
                              }}
                              accessibilityRole="button"
                              accessibilityState={{ disabled }}
                            >
                              <Text style={styles.hubLevelGridCellTitle}>
                                {level}
                              </Text>
                              {disabled ? (
                                <Text style={styles.hubLevelGridCellEmpty}>
                                  Brak znanych słów na tym poziomie.
                                </Text>
                              ) : (
                                <Text style={styles.hubLevelGridCellMeta}>
                                  {n === 1 ? "1 word" : `${n} words`}
                                </Text>
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                ) : null}

                {sheet &&
                sheet.type !== "quick" &&
                sheet.type !== "level" ? (
                  <Pressable
                    android_ripple={ANDROID_RIPPLE_PRIMARY}
                    style={({ pressed }) => [
                      styles.hubStartSessionBtn,
                      styles.hubSessionSheetPrimary,
                      primarySolidPressStyle(pressed, false),
                    ]}
                    onPress={commitSession}
                    accessibilityRole="button"
                    accessibilityLabel="Start session"
                  >
                    <Text style={styles.hubStartSessionBtnText}>
                      Start Session
                    </Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
