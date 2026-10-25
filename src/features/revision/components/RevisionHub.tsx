import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from "@react-navigation/native";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, { ZoomInEasyDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { BrainIcon } from "@/src/components/icons/BrainIcon";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { PageSheetModal } from "@/src/components/ui/PageSheetModal";
import { CenteredUnlockCtaCard } from "@/src/components/ui/CenteredUnlockCtaCard";
import {
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  primarySolidPressStyle,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import { useNetworkStatus } from "@/src/providers/NetworkStatusProvider";
import type { RevisionSessionConfig } from "@/src/types/revisionSession";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { staleTimes } from "@/src/lib/query/staleTimes";
import { getRevisionDashboardStats } from "@/src/features/revision/services/revisionRpc.service";
import { logUserAction } from "@/src/utils/userActionLog";

import {
  defaultRevisionSessionSize,
  getRevisionSessionSizeOptions,
  resolveRevisionSessionCount,
  revisionSessionSizeEnabled,
  type RevisionSessionSize,
} from "@/src/features/revision/revisionSessionSize";
import {
  RevisionFlashcardHowToReadyCue,
  RevisionFlashcardHowToSection,
} from "@/src/features/revision/components/RevisionFlashcardHowToSection";
import { RevisionProgressDashboard } from "@/src/features/revision/components/dashboard/RevisionProgressDashboard";
import { revisionScreenStyles as styles } from "../revisionScreenStyles";

export type RevisionHubCounts = {
  daily: number;
  recent: number;
  all: number;
};

type RevisionHubProps = {
  knownTotal: number;
  /** Gdy false — liczniki jeszcze z RPC; nie pokazuj stanu „0 słów / odblokuj”. */
  hubStatsReady?: boolean;
  /**
   * Tylko gdy `get_revision_hub_stats` zwróciło `knownCount === 0` — nie opieraj na samym `knownTotal`
   * ze state (race: `isFetched` zanim effect zaktualizuje `hubCounts`).
   */
  unlockEmptyCtaConfirmed?: boolean;
  counts: RevisionHubCounts;
  /** Ukończono dziś sesję Daily Review (lokalna data kalendarza). */
  dailyReviewCompletedToday?: boolean;
  /** Bieżący streak Daily Review (dni z rzędu). */
  dailyReviewStreak?: number;
  difficultWordsCount?: number;
  onSelectSession: (config: RevisionSessionConfig) => void;
  /** Gdy brak: zakładka Revision Hub (bez cofania do biblioteki). */
  onBackToLibrary?: () => void;
};

const QUICK_SIZES = [5, 10, 20] as const;

/** Wejście ikony streaku: jakby „zapłonęła” (od dołu + spring). */
const STREAK_FLAME_ENTERING = ZoomInEasyDown.springify()
  .stiffness(260)
  .damping(15)
  .mass(0.55);

type HubIntroSheet =
  | { type: "daily" }
  | { type: "quick" }
  | { type: "recent" }
  | { type: "difficult" };

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
  t: TFunction,
  sheet: HubIntroSheet,
  counts: RevisionHubCounts,
  knownTotal: number,
  dailyCompletedToday: boolean,
  difficultWordsCount: number,
): { title: string; subtitle?: string; body: string } {
  switch (sheet.type) {
    case "daily": {
      let subtitle: string | undefined;
      if (knownTotal >= 1) {
        if (counts.daily > 0) {
          subtitle = t("revision.hub.wordsReady", { count: counts.daily });
        } else if (dailyCompletedToday) {
          subtitle = t("revision.hub.introDoneForToday");
        } else {
          subtitle = t("revision.hub.dailyMetaNoWordsToday");
        }
      }
      return {
        title: t("revision.hub.introDailyTitle"),
        subtitle,
        body: t("revision.hub.introDailyBody"),
      };
    }
    case "quick":
      return {
        title: t("revision.hub.introQuickTitle"),
        subtitle: t("revision.hub.introQuickSubtitle"),
        body: t("revision.hub.introQuickBody"),
      };
    case "recent":
      return {
        title: t("revision.hub.introRecentTitle"),
        subtitle:
          knownTotal < 1
            ? undefined
            : t("revision.hub.recentWords", { count: counts.recent }),
        body: t("revision.hub.introRecentBody"),
      };
    case "difficult":
      return {
        title: t("revision.hub.difficultCardTitle"),
        subtitle: t("revision.hub.difficultWordsCount", {
          count: difficultWordsCount,
        }),
        body: t("revision.hub.introDifficultBody"),
      };
  }
}

export function RevisionHub({
  knownTotal,
  hubStatsReady = true,
  unlockEmptyCtaConfirmed = false,
  counts,
  dailyReviewCompletedToday = false,
  dailyReviewStreak = 0,
  difficultWordsCount = 0,
  onSelectSession,
  onBackToLibrary,
}: RevisionHubProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [sheet, setSheet] = useState<HubIntroSheet | null>(null);
  const [quickCount, setQuickCount] = useState<5 | 10 | 20>(10);
  const [recentCount, setRecentCount] = useState<RevisionSessionSize>(10);
  const [difficultCount, setDifficultCount] = useState<RevisionSessionSize>(10);
  const [streakFlameAnimKey, setStreakFlameAnimKey] = useState(0);
  const { isLikelyOffline: hubNetworkOffline } = useNetworkStatus();
  const skipStreakFlameReplayOnFirstFocus = useRef(true);
  const insets = useSafeAreaInsets();

  const dashboardQuery = useQuery({
    queryKey: queryKeys.revision.dashboardStats,
    queryFn: getRevisionDashboardStats,
    enabled: hubStatsReady && knownTotal >= 1,
    staleTime: staleTimes.revisionDashboardStats,
    placeholderData: keepPreviousData,
  });

  const dailyUnlocked = knownTotal >= 1;
  const recentUnlocked = knownTotal >= 1;
  const quickUnlocked = knownTotal >= 5;
  const difficultUnlocked = difficultWordsCount > 0;
  const recentSizeOptions = useMemo(
    () => getRevisionSessionSizeOptions(counts.recent),
    [counts.recent],
  );
  const difficultSizeOptions = useMemo(
    () => getRevisionSessionSizeOptions(difficultWordsCount),
    [difficultWordsCount],
  );
  const dailyEnabled =
    hubStatsReady && dailyUnlocked && counts.daily > 0;
  /** Ukończono dziś Daily Review i nie ma już słów w kolejce, pokazujemy „Completed” / „Done for today”. */
  const dailyReviewDoneForToday =
    dailyReviewCompletedToday && counts.daily === 0;

  const dailyWordsReadyLabel = useMemo(() => {
    if (!hubStatsReady) {
      return "…";
    }
    if (!dailyUnlocked) {
      return t("revision.hub.dailyMetaUnlock");
    }
    if (counts.daily === 0) {
      return t("revision.hub.dailyMetaNoWordsToday");
    }
    return t("revision.hub.wordsReady", { count: counts.daily });
  }, [hubStatsReady, dailyUnlocked, counts.daily, t]);

  /** Fragment po przecinku przy „Keep your streak alive” (ten sam sens co dolny label słów). */
  const streakWordsReadyFragment = useMemo(() => {
    if (!hubStatsReady) {
      return "";
    }
    if (!dailyUnlocked) {
      return "";
    }
    if (counts.daily === 0) {
      return t("revision.hub.streakFragmentNoWords");
    }
    return t("revision.hub.wordsReady", { count: counts.daily });
  }, [hubStatsReady, dailyUnlocked, counts.daily, t]);

  const showDailyStreakRow =
    hubStatsReady && dailyUnlocked && !dailyReviewCompletedToday;

  /**
   * Ikona + liczba u góry karty Daily, gdy tryb jest odblokowany — w tym:
   * Recommended, „Start next session” (ukończono dziś, ale są jeszcze słowa), Completed.
   */
  const showTopStreakInline = hubStatsReady && dailyUnlocked;

  useFocusEffect(
    useCallback(() => {
      if (!showTopStreakInline) {
        return;
      }
      if (skipStreakFlameReplayOnFirstFocus.current) {
        skipStreakFlameReplayOnFirstFocus.current = false;
        return;
      }
      setStreakFlameAnimKey((k) => k + 1);
    }, [showTopStreakInline]),
  );

  const recentLabel = useMemo(() => {
    if (!hubStatsReady) {
      return "…";
    }
    if (!recentUnlocked) {
      return t("revision.hub.recentMetaLocked");
    }
    if (counts.recent >= 5) {
      return t("revision.hub.quickMetaSizes");
    }
    return t("revision.hub.recentWords", { count: counts.recent });
  }, [hubStatsReady, recentUnlocked, counts.recent, t]);

  const difficultLabel = useMemo(() => {
    if (!hubStatsReady) {
      return "…";
    }
    if (difficultWordsCount === 0) {
      return t("revision.hub.difficultMetaEmpty");
    }
    if (difficultWordsCount >= 5) {
      return t("revision.hub.quickMetaSizes");
    }
    return t("revision.hub.difficultMetaCount", { count: difficultWordsCount });
  }, [hubStatsReady, difficultWordsCount, t]);

  const quickLabel = useMemo(() => {
    if (!hubStatsReady) {
      return "…";
    }
    if (!quickUnlocked) {
      return t("revision.hub.quickMetaLocked");
    }
    return t("revision.hub.quickMetaSizes");
  }, [hubStatsReady, quickUnlocked, t]);

  const openSheet = useCallback((next: HubIntroSheet) => {
    setSheet(next);
  }, []);

  const closeSheet = useCallback(() => {
    logUserAction("button_press", {
      target: "revision_hub_session_intro_sheet_close",
    });
    setSheet(null);
  }, []);

  const openDailySheet = useCallback(() => {
    if (!dailyEnabled) {
      return;
    }
    logUserAction("button_press", {
      target: "revision_hub_open_session_intro",
      kind: "daily",
    });
    openSheet({ type: "daily" });
  }, [dailyEnabled, openSheet]);

  const openRecentSheet = useCallback(() => {
    if (!recentUnlocked) {
      return;
    }
    logUserAction("button_press", {
      target: "revision_hub_open_session_intro",
      kind: "recent",
    });
    const next = defaultRevisionSessionSize(counts.recent);
    if (next === 5 || next === 10 || next === 20) {
      setRecentCount(next);
    }
    openSheet({ type: "recent" });
  }, [recentUnlocked, counts.recent, openSheet]);

  const openDifficultSheet = useCallback(() => {
    if (!difficultUnlocked) {
      return;
    }
    logUserAction("button_press", {
      target: "revision_hub_open_session_intro",
      kind: "difficult",
    });
    const next = defaultRevisionSessionSize(difficultWordsCount);
    if (next === 5 || next === 10 || next === 20) {
      setDifficultCount(next);
    }
    setSheet({ type: "difficult" });
  }, [difficultUnlocked, difficultWordsCount]);

  const openQuickSheet = useCallback(() => {
    if (!quickUnlocked) {
      return;
    }
    logUserAction("button_press", {
      target: "revision_hub_open_session_intro",
      kind: "quick",
    });
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
      const pool = counts.recent;
      if (pool < 1) {
        return;
      }
      if (recentSizeOptions.length === 0) {
        onSelectSession({ kind: "recent", count: pool });
      } else if (revisionSessionSizeEnabled(pool, recentCount)) {
        onSelectSession({
          kind: "recent",
          count: resolveRevisionSessionCount(pool, recentCount),
        });
      }
    } else if (sheet.type === "difficult") {
      if (!difficultUnlocked) {
        return;
      }
      const pool = difficultWordsCount;
      if (pool < 1) {
        return;
      }
      if (difficultSizeOptions.length === 0) {
        onSelectSession({ kind: "difficultWords", limit: pool });
      } else if (revisionSessionSizeEnabled(pool, difficultCount)) {
        onSelectSession({
          kind: "difficultWords",
          limit: resolveRevisionSessionCount(pool, difficultCount),
        });
      }
    }
    setSheet(null);
  }, [
    sheet,
    quickCount,
    quickUnlocked,
    dailyUnlocked,
    recentUnlocked,
    difficultUnlocked,
    counts.recent,
    recentSizeOptions,
    recentCount,
    difficultWordsCount,
    difficultSizeOptions,
    difficultCount,
    knownTotal,
    onSelectSession,
  ]);

  const intro =
    sheet === null
      ? null
      : getHubIntro(
          t,
          sheet,
          counts,
          knownTotal,
          dailyReviewCompletedToday,
          difficultWordsCount,
        );

  const goToDailyWord = useCallback(() => {
    logUserAction("button_press", {
      target: "revision_hub_unlock_cta_daily_word",
    });
    router.push("/(tabs)/home");
  }, [router]);

  return (
    <View style={styles.listScreen}>
      <ScreenHeader
        title={t("revision.hubTitle")}
        {...(onBackToLibrary
          ? {
              onBackPress: onBackToLibrary,
              backAccessibilityLabel: t("revision.backToLibrary"),
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
        {unlockEmptyCtaConfirmed ? (
          <CenteredUnlockCtaCard
            icon="lock-closed-outline"
            title={t("revision.hub.unlockTitle")}
            body={t("revision.hub.unlockBody")}
            primaryLabel={t("revision.hub.unlockCta")}
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
                /** Nie przyciemniaj karty, dopóki nie znamy liczników — unikamy migania „disabled”. */
                hubStatsReady && !dailyEnabled && styles.buttonDisabled,
                surfacePressStyle(pressed, !dailyEnabled),
              ]}
              onPress={openDailySheet}
              accessibilityRole="button"
              accessibilityLabel={t("revision.hub.a11yDailyReview")}
              accessibilityState={{ disabled: !dailyEnabled }}
            >
              <View
                style={styles.hubDailyTopBadgesRow}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {dailyUnlocked && dailyReviewDoneForToday ? (
                  <View
                    style={[
                      styles.hubDailyRecommendedBadge,
                      styles.hubDailyCompletedBadge,
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={15}
                      color="#286C34"
                    />
                    <Text style={styles.hubDailyCompletedBadgeText}>
                      {t("revision.hub.dailyBadgeCompleted")}
                    </Text>
                  </View>
                ) : dailyUnlocked && counts.daily > 0 ? (
                  <View style={styles.hubDailyRecommendedBadge}>
                    <Ionicons
                      name="sparkles"
                      size={15}
                      color={StitchColors.primary}
                    />
                    <Text style={styles.hubDailyRecommendedBadgeText}>
                      {t("revision.hub.dailyBadgeRecommended")}
                    </Text>
                  </View>
                ) : null}
                {showTopStreakInline ? (
                  <View
                    style={styles.hubDailyStreakInline}
                    accessibilityLabel={t("revision.hub.a11yStreak", {
                      count: dailyReviewStreak,
                    })}
                  >
                    <Animated.View
                      key={streakFlameAnimKey}
                      entering={STREAK_FLAME_ENTERING}
                      style={styles.hubDailyStreakFlameWrap}
                    >
                      <Ionicons
                        name="flame"
                        size={20}
                        color="#D32F2F"
                      />
                    </Animated.View>
                    <View style={styles.hubDailyStreakCountWrap}>
                      <Text style={styles.hubDailyStreakTagNumber}>
                        {dailyReviewStreak}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  styles.hubIconCircle,
                  { backgroundColor: `${StitchColors.primary}18` },
                ]}
              >
                <BrainIcon
                  size={26}
                  color={StitchColors.primary}
                />
              </View>
              <Text style={styles.hubCardTitleSm}>
                {t("revision.hub.dailyCardTitle")}
              </Text>
              <Text style={styles.hubCardDescSm}>
                {t("revision.hub.dailyCardDesc")}
              </Text>
              <View style={styles.hubDailyBottomRow}>
                <View style={styles.hubDailyBottomLeft}>
                  {showDailyStreakRow ? (
                    <View style={styles.hubDailyStreakRowBottom}>
                      <Text style={styles.hubDailyStreakCaption}>
                        {t("revision.hub.dailyStreakCaption", {
                          fragment: streakWordsReadyFragment,
                        })}
                      </Text>
                    </View>
                  ) : dailyUnlocked && dailyReviewDoneForToday ? (
                    <View style={styles.hubDailyDoneRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#286C34"
                      />
                      <Text style={styles.hubDailyDoneLabel}>
                        {t("revision.hub.dailyDoneLabel")}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.hubSmallMetaText}>
                      {dailyWordsReadyLabel}
                    </Text>
                  )}
                </View>
                <Ionicons
                  name={
                    !hubStatsReady
                      ? "ellipsis-horizontal"
                      : dailyUnlocked
                        ? "arrow-forward"
                        : "lock-closed-outline"
                  }
                  size={18}
                  color={StitchColors.onSurfaceVariant}
                  style={styles.hubDailyBottomArrow}
                />
              </View>
            </Pressable>
          </View>

          <View style={styles.hubTileFull}>
            <Pressable
              disabled={!hubStatsReady || !recentUnlocked}
              android_ripple={ANDROID_RIPPLE_SURFACE}
              style={({ pressed }) => [
                styles.hubCardWhite,
                hubStatsReady && !recentUnlocked && styles.buttonDisabled,
                surfacePressStyle(pressed, !hubStatsReady || !recentUnlocked),
              ]}
              onPress={openRecentSheet}
              accessibilityRole="button"
              accessibilityLabel={t("revision.hub.a11yRecentlyLearned")}
              accessibilityState={{
                disabled: !hubStatsReady || !recentUnlocked,
              }}
            >
              <View
                style={[
                  styles.hubIconCircle,
                  { backgroundColor: "rgba(40, 108, 52, 0.12)" },
                ]}
              >
                <MaterialCommunityIcons
                  name="clock-plus-outline"
                  size={26}
                  color="#286C34"
                />
              </View>
              <Text style={styles.hubCardTitleSm}>
                {t("revision.hub.recentCardTitle")}
              </Text>
              <Text style={styles.hubCardDescSm}>
                {t("revision.hub.recentCardDesc")}
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
              disabled={!hubStatsReady || !difficultUnlocked}
              android_ripple={ANDROID_RIPPLE_SURFACE}
              style={({ pressed }) => [
                styles.hubCardWhite,
                hubStatsReady && !difficultUnlocked && styles.buttonDisabled,
                surfacePressStyle(pressed, !hubStatsReady || !difficultUnlocked),
              ]}
              onPress={openDifficultSheet}
              accessibilityRole="button"
              accessibilityLabel={t("revision.hub.a11yDifficultWords")}
              accessibilityState={{
                disabled: !hubStatsReady || !difficultUnlocked,
              }}
            >
              <View
                style={[
                  styles.hubIconCircle,
                  { backgroundColor: "rgba(211, 47, 47, 0.12)" },
                ]}
              >
                <MaterialIcons
                  name="flag"
                  size={26}
                  color="#C62828"
                />
              </View>
              <Text style={styles.hubCardTitleSm}>
                {t("revision.hub.difficultCardTitle")}
              </Text>
              <Text style={styles.hubCardDescSm}>
                {t("revision.hub.difficultCardDesc")}
              </Text>
              {hubStatsReady && difficultWordsCount === 0 ? (
                <Text style={styles.hubDifficultEmptyHint}>
                  {t("revision.hub.difficultEmptyOnCard")}
                </Text>
              ) : null}
              <View style={styles.hubSmallMetaRow}>
                <Text style={styles.hubSmallMetaText}>{difficultLabel}</Text>
                <Ionicons
                  name={
                    difficultUnlocked ? "arrow-forward" : "lock-closed-outline"
                  }
                  size={18}
                  color={StitchColors.onSurfaceVariant}
                />
              </View>
            </Pressable>
          </View>

          <View style={styles.hubTileFull}>
            <Pressable
              disabled={!hubStatsReady || !quickUnlocked}
              android_ripple={ANDROID_RIPPLE_SURFACE}
              style={({ pressed }) => [
                styles.hubCardWhite,
                hubStatsReady && !quickUnlocked && styles.buttonDisabled,
                surfacePressStyle(pressed, !hubStatsReady || !quickUnlocked),
              ]}
              onPress={openQuickSheet}
              accessibilityRole="button"
              accessibilityLabel={t("revision.hub.a11yQuickPractice")}
              accessibilityState={{
                disabled: !hubStatsReady || !quickUnlocked,
              }}
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
              <Text style={styles.hubCardTitleSm}>
                {t("revision.hub.quickCardTitle")}
              </Text>
              <Text style={styles.hubCardDescSm}>
                {t("revision.hub.quickCardDesc")}
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

        {!unlockEmptyCtaConfirmed && hubStatsReady ? (
          <RevisionProgressDashboard
            data={dashboardQuery.data}
            isLoading={dashboardQuery.isLoading}
            isError={dashboardQuery.isError}
          />
        ) : null}
      </ScrollView>

      <PageSheetModal visible={sheet !== null} onRequestClose={closeSheet}>
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

                <RevisionFlashcardHowToSection
                  variant={
                    sheet?.type === "difficult" ? "difficultWords" : "default"
                  }
                />

                {sheet?.type === "daily" && hubNetworkOffline ? (
                  <View
                    style={styles.hubDailyOfflineTag}
                    accessibilityRole="alert"
                  >
                    <Ionicons
                      name="cloud-offline-outline"
                      size={22}
                      color={StitchColors.error}
                      accessibilityIgnoresInvertColors
                    />
                    <View style={styles.hubDailyOfflineTagTextCol}>
                      <Text style={styles.hubDailyOfflineTagLabel}>
                        {t("revision.hub.offlineModeLabel")}
                      </Text>
                      <Text style={styles.hubDailyOfflineTagBody}>
                        {t("revision.hub.offlineDailyBody")}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {sheet?.type === "recent" && recentSizeOptions.length > 0 ? (
                  <>
                    <Text style={styles.hubSessionSheetSectionLabel}>
                      {t("revision.hub.quickChooseWordCount")}
                    </Text>
                    <View style={styles.hubQuickRow}>
                      {QUICK_SIZES.map((n) => {
                        const enabled = revisionSessionSizeEnabled(
                          counts.recent,
                          n,
                        );
                        const selected = recentCount === n;
                        const need = moreWordsNeeded(counts.recent, n);
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
                              onPress={() => {
                                logUserAction("button_press", {
                                  target: "revision_hub_recent_size",
                                  size: n,
                                });
                                setRecentCount(n);
                              }}
                              accessibilityRole="button"
                              accessibilityState={{
                                selected: selected && enabled,
                                disabled: !enabled,
                              }}
                              accessibilityLabel={t(
                                "revision.hub.a11yQuickSize",
                                { count: n },
                              )}
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
                                {t("revision.hub.quickWordsLabel")}
                              </Text>
                            </Pressable>
                            {!enabled && need > 0 && (n === 10 || n === 20) ? (
                              <Text style={styles.hubQuickSizeHint}>
                                {t("revision.hub.recentUnlockHint", {
                                  need,
                                  n,
                                  wordsWord:
                                    need === 1
                                      ? t("revision.hub.wordSingular")
                                      : t("revision.hub.wordPlural"),
                                })}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                    <RevisionFlashcardHowToReadyCue />
                    <Pressable
                      android_ripple={ANDROID_RIPPLE_PRIMARY}
                      style={({ pressed }) => [
                        styles.hubStartSessionBtn,
                        styles.hubSessionSheetPrimary,
                        (!recentUnlocked ||
                          !revisionSessionSizeEnabled(
                            counts.recent,
                            recentCount,
                          )) &&
                          styles.buttonDisabled,
                        primarySolidPressStyle(
                          pressed,
                          !recentUnlocked ||
                            !revisionSessionSizeEnabled(
                              counts.recent,
                              recentCount,
                            ),
                        ),
                      ]}
                      disabled={
                        !recentUnlocked ||
                        !revisionSessionSizeEnabled(counts.recent, recentCount)
                      }
                      onPress={commitSession}
                      accessibilityRole="button"
                      accessibilityLabel={t("revision.hub.startSession")}
                    >
                      <Text style={styles.hubStartSessionBtnText}>
                        {t("revision.hub.startSession")}
                      </Text>
                    </Pressable>
                  </>
                ) : null}

                {sheet?.type === "difficult" &&
                difficultSizeOptions.length > 0 ? (
                  <>
                    <Text style={styles.hubSessionSheetSectionLabel}>
                      {t("revision.hub.quickChooseWordCount")}
                    </Text>
                    <View style={styles.hubQuickRow}>
                      {QUICK_SIZES.map((n) => {
                        const enabled = revisionSessionSizeEnabled(
                          difficultWordsCount,
                          n,
                        );
                        const selected = difficultCount === n;
                        const need = moreWordsNeeded(
                          difficultWordsCount,
                          n,
                        );
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
                              onPress={() => {
                                logUserAction("button_press", {
                                  target: "revision_hub_difficult_size",
                                  size: n,
                                });
                                setDifficultCount(n);
                              }}
                              accessibilityRole="button"
                              accessibilityState={{
                                selected: selected && enabled,
                                disabled: !enabled,
                              }}
                              accessibilityLabel={t(
                                "revision.hub.a11yDifficultSize",
                                { count: n },
                              )}
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
                                {t("revision.hub.quickWordsLabel")}
                              </Text>
                            </Pressable>
                            {!enabled && need > 0 && (n === 10 || n === 20) ? (
                              <Text style={styles.hubQuickSizeHint}>
                                {t("revision.hub.difficultUnlockHint", {
                                  need,
                                  n,
                                  wordsWord:
                                    need === 1
                                      ? t("revision.hub.wordSingular")
                                      : t("revision.hub.wordPlural"),
                                })}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                    <RevisionFlashcardHowToReadyCue />
                    <Pressable
                      android_ripple={ANDROID_RIPPLE_PRIMARY}
                      style={({ pressed }) => [
                        styles.hubStartSessionBtn,
                        styles.hubSessionSheetPrimary,
                        (!difficultUnlocked ||
                          !revisionSessionSizeEnabled(
                            difficultWordsCount,
                            difficultCount,
                          )) &&
                          styles.buttonDisabled,
                        primarySolidPressStyle(
                          pressed,
                          !difficultUnlocked ||
                            !revisionSessionSizeEnabled(
                              difficultWordsCount,
                              difficultCount,
                            ),
                        ),
                      ]}
                      disabled={
                        !difficultUnlocked ||
                        !revisionSessionSizeEnabled(
                          difficultWordsCount,
                          difficultCount,
                        )
                      }
                      onPress={commitSession}
                      accessibilityRole="button"
                      accessibilityLabel={t("revision.hub.startSession")}
                    >
                      <Text style={styles.hubStartSessionBtnText}>
                        {t("revision.hub.startSession")}
                      </Text>
                    </Pressable>
                  </>
                ) : null}

                {sheet?.type === "quick" ? (
                  <>
                    <Text style={styles.hubSessionSheetSectionLabel}>
                      {t("revision.hub.quickChooseWordCount")}
                    </Text>
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
                              onPress={() => {
                                logUserAction("button_press", {
                                  target: "revision_hub_quick_size",
                                  size: n,
                                });
                                setQuickCount(n);
                              }}
                              accessibilityRole="button"
                              accessibilityState={{
                                selected: selected && enabled,
                                disabled: !enabled,
                              }}
                              accessibilityLabel={t(
                                "revision.hub.a11yQuickSize",
                                { count: n },
                              )}
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
                                {t("revision.hub.quickWordsLabel")}
                              </Text>
                            </Pressable>
                            {!enabled && need > 0 && (n === 10 || n === 20) ? (
                              <Text style={styles.hubQuickSizeHint}>
                                {t("revision.hub.quickUnlockHint", {
                                  need,
                                  n,
                                  wordsWord:
                                    need === 1
                                      ? t("revision.hub.wordSingular")
                                      : t("revision.hub.wordPlural"),
                                })}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                    <RevisionFlashcardHowToReadyCue />
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
                      accessibilityLabel={t("revision.hub.startSession")}
                    >
                      <Text style={styles.hubStartSessionBtnText}>
                        {t("revision.hub.startSession")}
                      </Text>
                    </Pressable>
                  </>
                ) : null}

                {sheet &&
                (sheet.type === "daily" ||
                  (sheet.type === "recent" && recentSizeOptions.length === 0) ||
                  (sheet.type === "difficult" &&
                    difficultSizeOptions.length === 0)) ? (
                  <>
                    <RevisionFlashcardHowToReadyCue />
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
                        ? t("revision.hub.startNextSession")
                        : t("revision.hub.startSession")
                    }
                  >
                    <Text style={styles.hubStartSessionBtnText}>
                      {sheet.type === "daily" &&
                      dailyReviewCompletedToday &&
                      counts.daily > 0
                        ? t("revision.hub.startNextSession")
                        : t("revision.hub.startSession")}
                    </Text>
                    </Pressable>
                  </>
                ) : null}
              </ScrollView>
            </>
          ) : null}
        </View>
      </PageSheetModal>
    </View>
  );
}
