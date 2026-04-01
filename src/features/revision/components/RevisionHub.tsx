import { Ionicons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { CenteredUnlockCtaCard } from "@/src/components/ui/CenteredUnlockCtaCard";
import {
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  primarySolidPressStyle,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import type { RevisionSessionConfig } from "@/src/types/revisionSession";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";

import { revisionScreenStyles as styles } from "../revisionScreenStyles";

export type RevisionHubCounts = {
  daily: number;
  recent: number;
  all: number;
};

type RevisionHubProps = {
  knownTotal: number;
  counts: RevisionHubCounts;
  /** Ukończono dziś sesję Daily Review (lokalna data kalendarza). */
  dailyReviewCompletedToday?: boolean;
  onSelectSession: (config: RevisionSessionConfig) => void;
  /** Gdy brak: zakładka Revision Hub (bez cofania do biblioteki). */
  onBackToLibrary?: () => void;
};

const QUICK_SIZES = [5, 10, 20] as const;

type HubIntroSheet =
  | { type: "daily" }
  | { type: "quick" }
  | { type: "recent" };

function defaultQuickCount(knownTotal: number): 5 | 10 | 20 {
  if (knownTotal >= 20) {
    return 20;
  }
  if (knownTotal >= 10) {
    return 10;
  }
  return 5;
}

function quickSizeEnabled(knownTotal: number, n: 5 | 10 | 20): boolean {
  return knownTotal >= n;
}

function moreWordsNeeded(knownTotal: number, target: 5 | 10 | 20): number {
  return Math.max(0, target - knownTotal);
}

function getHubIntro(
  sheet: HubIntroSheet,
  counts: RevisionHubCounts,
  knownTotal: number,
  dailyCompletedToday: boolean,
): { title: string; subtitle?: string; body: string } {
  switch (sheet.type) {
    case "daily": {
      let subtitle: string | undefined;
      if (knownTotal >= 1) {
        if (counts.daily > 0) {
          subtitle =
            counts.daily === 1 ? "1 word ready" : `${counts.daily} words ready`;
        } else if (dailyCompletedToday) {
          subtitle = "Done for today";
        } else {
          subtitle = "Brak słów do powtórki dziś";
        }
      }
      return {
        title: "Daily Review",
        subtitle,
        body:
          "Smart review based on how memory works.\n\n" +
          "We pick a manageable set for today (up to 20 words): due words first, " +
          "then what is next in your schedule, with newest words as a fallback when needed. " +
          "This mode grows smarter over time as your progress data builds up.",
      };
    }
    case "quick":
      return {
        title: "Quick Practice",
        subtitle: "A short mixed practice session",
        body:
          "A short, random mix from your known words, without heavy scheduling. " +
          "Pick 5, 10, or 20 cards and practice when you have a minute.",
      };
    case "recent":
      return {
        title: "Recently Learned",
        subtitle:
          knownTotal < 1
            ? undefined
            : counts.recent === 1
              ? "1 word"
              : `${counts.recent} words`,
        body:
          "Practice your newest words (up to 20), ordered by when you learned them. " +
          "Great for reinforcing what you just added to your known list.",
      };
  }
}

export function RevisionHub({
  knownTotal,
  counts,
  dailyReviewCompletedToday = false,
  onSelectSession,
  onBackToLibrary,
}: RevisionHubProps) {
  const router = useRouter();
  const [sheet, setSheet] = useState<HubIntroSheet | null>(null);
  const [quickCount, setQuickCount] = useState<5 | 10 | 20>(10);
  const insets = useSafeAreaInsets();

  const dailyUnlocked = knownTotal >= 1;
  const recentUnlocked = knownTotal >= 1;
  const quickUnlocked = knownTotal >= 5;
  const dailyEnabled = dailyUnlocked && counts.daily > 0;
  /** Ukończono dziś Daily Review i nie ma już słów w kolejce, pokazujemy „Completed” / „Done for today”. */
  const dailyReviewDoneForToday =
    dailyReviewCompletedToday && counts.daily === 0;

  const dailyWordsReadyLabel = useMemo(() => {
    if (!dailyUnlocked) {
      return "Odblokuj: naucz się 1 słowa w Daily Word";
    }
    if (counts.daily === 0) {
      return "Brak słów do powtórki dziś";
    }
    return counts.daily === 1 ? "1 word ready" : `${counts.daily} words ready`;
  }, [dailyUnlocked, counts.daily]);

  const recentLabel = useMemo(() => {
    if (!recentUnlocked) {
      return "Learn your first word to unlock this mode";
    }
    return counts.recent === 1 ? "1 word" : `${counts.recent} words`;
  }, [recentUnlocked, counts.recent]);

  const quickLabel = useMemo(() => {
    if (!quickUnlocked) {
      return "Unlocks after learning 5 words";
    }
    return "5, 10, or 20 words";
  }, [quickUnlocked]);

  const openSheet = useCallback((next: HubIntroSheet) => {
    setSheet(next);
  }, []);

  const closeSheet = useCallback(() => {
    setSheet(null);
  }, []);

  const openDailySheet = useCallback(() => {
    if (!dailyEnabled) {
      return;
    }
    openSheet({ type: "daily" });
  }, [dailyEnabled, openSheet]);

  const openRecentSheet = useCallback(() => {
    if (!recentUnlocked) {
      return;
    }
    openSheet({ type: "recent" });
  }, [recentUnlocked, openSheet]);

  const openQuickSheet = useCallback(() => {
    if (!quickUnlocked) {
      return;
    }
    setQuickCount(defaultQuickCount(knownTotal));
    setSheet({ type: "quick" });
  }, [quickUnlocked, knownTotal]);

  const commitSession = useCallback(() => {
    if (!sheet) {
      return;
    }
    if (sheet.type === "quick") {
      if (!quickUnlocked || !quickSizeEnabled(knownTotal, quickCount)) {
        return;
      }
      onSelectSession({ kind: "quick", count: quickCount });
    } else if (sheet.type === "daily") {
      if (!dailyUnlocked) {
        return;
      }
      onSelectSession({ kind: "daily" });
    } else if (sheet.type === "recent") {
      if (!recentUnlocked) {
        return;
      }
      onSelectSession({ kind: "recent" });
    }
    setSheet(null);
  }, [
    sheet,
    quickCount,
    quickUnlocked,
    dailyUnlocked,
    recentUnlocked,
    knownTotal,
    onSelectSession,
  ]);

  const intro =
    sheet === null
      ? null
      : getHubIntro(sheet, counts, knownTotal, dailyReviewCompletedToday);

  const goToDailyWord = useCallback(() => {
    router.push("/(tabs)/home");
  }, [router]);

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
        {knownTotal === 0 ? (
          <CenteredUnlockCtaCard
            icon="lock-closed-outline"
            title="Odblokuj powtórki"
            body="Naucz się pierwszego słowa, aby odblokować Revision. Potem wróć tu i zacznij regularne powtórki."
            primaryLabel="Przejdź do Daily Word"
            onPrimaryPress={goToDailyWord}
          />
        ) : null}

        <View style={styles.hubBentoWrap}>
          <View style={styles.hubTileFull}>
            <Pressable
              disabled={!dailyEnabled}
              android_ripple={ANDROID_RIPPLE_SURFACE}
              style={({ pressed }) => [
                styles.hubCardWhite,
                styles.hubDailyFeatured,
                dailyUnlocked &&
                  dailyReviewDoneForToday &&
                  styles.hubDailyFeaturedCompleted,
                !dailyEnabled && styles.buttonDisabled,
                surfacePressStyle(pressed, !dailyEnabled),
              ]}
              onPress={openDailySheet}
              accessibilityRole="button"
              accessibilityLabel="Daily Review, recommended"
              accessibilityState={{ disabled: !dailyEnabled }}
            >
              <View
                style={[
                  styles.hubDailyRecommendedBadge,
                  dailyUnlocked &&
                    dailyReviewDoneForToday &&
                    styles.hubDailyCompletedBadge,
                ]}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {dailyUnlocked && dailyReviewDoneForToday ? (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={13}
                      color="#286C34"
                    />
                    <Text style={styles.hubDailyCompletedBadgeText}>
                      Completed
                    </Text>
                  </>
                ) : dailyUnlocked && counts.daily > 0 ? (
                  <>
                    <Ionicons
                      name="sparkles"
                      size={13}
                      color={StitchColors.primary}
                    />
                    <Text style={styles.hubDailyRecommendedBadgeText}>
                      Recommended
                    </Text>
                  </>
                ) : null}
              </View>
              <View style={styles.hubDailyIconDecor} pointerEvents="none">
                <MaterialIcons
                  name="psychology"
                  size={112}
                  color={StitchColors.primary}
                />
              </View>
              <View
                style={[styles.hubDailyTextBlock, styles.hubDailyTextBlockWithBadge]}
              >
                <Text style={styles.hubDailyCardTitle}>Daily Review</Text>
                <Text style={styles.hubDailyDesc}>
                  Smart review based on how memory works
                </Text>
              </View>
              <View style={styles.hubDailyMetaRow}>
                {dailyUnlocked && dailyReviewDoneForToday ? (
                  <View style={styles.hubDailyDoneRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#286C34"
                    />
                    <Text style={styles.hubDailyDoneLabel}>
                      Done for today
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.hubSmallMetaText}>
                    {dailyWordsReadyLabel}
                  </Text>
                )}
                <Ionicons
                  name={dailyUnlocked ? "arrow-forward" : "lock-closed-outline"}
                  size={18}
                  color={StitchColors.onSurfaceVariant}
                />
              </View>
            </Pressable>
          </View>

          <View style={styles.hubTileFull}>
            <Pressable
              disabled={!recentUnlocked}
              android_ripple={ANDROID_RIPPLE_SURFACE}
              style={({ pressed }) => [
                styles.hubCardWhite,
                !recentUnlocked && styles.buttonDisabled,
                surfacePressStyle(pressed, !recentUnlocked),
              ]}
              onPress={openRecentSheet}
              accessibilityRole="button"
              accessibilityLabel="Recently Learned"
              accessibilityState={{ disabled: !recentUnlocked }}
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
                Practice your newest words
              </Text>
              <View style={styles.hubSmallMetaRow}>
                <Text style={styles.hubSmallMetaText}>{recentLabel}</Text>
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
              disabled={!quickUnlocked}
              android_ripple={ANDROID_RIPPLE_SURFACE}
              style={({ pressed }) => [
                styles.hubCardWhite,
                !quickUnlocked && styles.buttonDisabled,
                surfacePressStyle(pressed, !quickUnlocked),
              ]}
              onPress={openQuickSheet}
              accessibilityRole="button"
              accessibilityLabel="Quick Practice"
              accessibilityState={{ disabled: !quickUnlocked }}
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
                A short mixed practice session
              </Text>
              <View style={styles.hubSmallMetaRow}>
                <Text style={styles.hubSmallMetaText}>{quickLabel}</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={StitchColors.onSurfaceVariant}
                />
              </View>
            </Pressable>
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
                      {QUICK_SIZES.map((n) => {
                        const enabled = quickSizeEnabled(knownTotal, n);
                        const selected = quickCount === n;
                        const need = moreWordsNeeded(knownTotal, n);
                        return (
                          <View key={n} style={{ flex: 1, minWidth: 0 }}>
                            <Pressable
                              disabled={!enabled}
                              android_ripple={ANDROID_RIPPLE_SURFACE}
                              style={({ pressed }) => [
                                styles.hubQuickSegment,
                                selected &&
                                  enabled &&
                                  styles.hubQuickSegmentSelected,
                                !enabled && styles.buttonDisabled,
                                surfacePressStyle(pressed, !enabled),
                              ]}
                              onPress={() => setQuickCount(n)}
                              accessibilityRole="button"
                              accessibilityState={{
                                selected: selected && enabled,
                                disabled: !enabled,
                              }}
                              accessibilityLabel={`${n} words`}
                            >
                              <Text
                                style={[
                                  styles.hubQuickSegmentValue,
                                  selected &&
                                    enabled &&
                                    styles.hubQuickSegmentValueSelected,
                                ]}
                              >
                                {n}
                              </Text>
                              <Text
                                style={[
                                  styles.hubQuickSegmentUnit,
                                  selected &&
                                    enabled &&
                                    styles.hubQuickSegmentUnitSelected,
                                ]}
                              >
                                words
                              </Text>
                            </Pressable>
                            {!enabled && need > 0 && (n === 10 || n === 20) ? (
                              <Text style={styles.hubQuickSizeHint}>
                                {`Learn ${need} more word${need === 1 ? "" : "s"} to unlock ${n}-word practice`}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                    <Pressable
                      android_ripple={ANDROID_RIPPLE_PRIMARY}
                      style={({ pressed }) => [
                        styles.hubStartSessionBtn,
                        styles.hubSessionSheetPrimary,
                        (!quickUnlocked ||
                          !quickSizeEnabled(knownTotal, quickCount)) &&
                          styles.buttonDisabled,
                        primarySolidPressStyle(
                          pressed,
                          !quickUnlocked ||
                            !quickSizeEnabled(knownTotal, quickCount),
                        ),
                      ]}
                      disabled={
                        !quickUnlocked ||
                        !quickSizeEnabled(knownTotal, quickCount)
                      }
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

                {sheet && sheet.type !== "quick" ? (
                  <Pressable
                    android_ripple={ANDROID_RIPPLE_PRIMARY}
                    style={({ pressed }) => [
                      styles.hubStartSessionBtn,
                      styles.hubSessionSheetPrimary,
                      primarySolidPressStyle(pressed, false),
                    ]}
                    onPress={commitSession}
                    accessibilityRole="button"
                    accessibilityLabel={
                      sheet.type === "daily" &&
                      dailyReviewCompletedToday &&
                      counts.daily > 0
                        ? "Start next session"
                        : "Start session"
                    }
                  >
                    <Text style={styles.hubStartSessionBtnText}>
                      {sheet.type === "daily" &&
                      dailyReviewCompletedToday &&
                      counts.daily > 0
                        ? "Start next session"
                        : "Start Session"}
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
