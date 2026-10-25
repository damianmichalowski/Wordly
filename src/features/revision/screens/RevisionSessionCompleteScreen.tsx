import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  primarySolidPressStyle,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import { formatSessionDurationMs } from "@/src/features/revision/revisionSessionUi";
import type { RevisionSessionCompletionStats } from "@/src/types/revisionSession";
import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";
import { LogTag, logger } from "@/src/utils/logger";

export type RevisionSessionCompleteScreenProps = {
  sessionStats: RevisionSessionCompletionStats;
  onBackToRevisionHub: () => void;
  onBackToHome: () => void;
  onRepeatDifficultSession?: () => void;
  /** Daily Review session: updated streak count from the server. */
  dailyReviewStreak?: number;
  /** Optional streak-related trophy title to show inline (no separate popup). */
  streakTrophyTitle?: string;
};

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function RevisionSessionCompleteScreen({
  sessionStats,
  onBackToRevisionHub,
  onBackToHome,
  onRepeatDifficultSession,
  dailyReviewStreak,
  streakTrophyTitle,
}: RevisionSessionCompleteScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    logger.info(LogTag.REVISION, "Completion screen opened");
  }, []);

  const endedEarly = sessionStats.endedEarly === true;
  const answerStats = sessionStats.answerStats;
  const difficultSummary = sessionStats.difficultWordsCompletion;
  const showDifficultSummary =
    sessionStats.mode.startsWith("difficultWords") && difficultSummary;
  const showDailyStreak =
    sessionStats.mode === "daily" && typeof dailyReviewStreak === "number";
  const durationLabel = formatSessionDurationMs(sessionStats.sessionDurationMs);
  const hasDifficultRemaining =
    showDifficultSummary && difficultSummary.stillDifficult > 0;
  const noDifficultLeft =
    showDifficultSummary && difficultSummary.stillDifficult === 0;

  const title = endedEarly
    ? t("revision.hub.sessionComplete.titleEarly")
    : t("revision.hub.sessionComplete.titleComplete");
  const subtitle = endedEarly
    ? t("revision.hub.sessionComplete.subtitleEarly")
    : t("revision.hub.sessionComplete.subtitleComplete");

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top + 24,
          paddingBottom: Math.max(insets.bottom, 20),
        },
      ]}
    >
      <View style={styles.centeredContent}>
        <Animated.View entering={ZoomIn.duration(400)} style={styles.iconWrap}>
          <Ionicons
            name={endedEarly ? "checkmark-circle-outline" : "checkmark-circle"}
            size={56}
            color={endedEarly ? StitchColors.primary : StitchColors.secondary}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(380).delay(60)}
          style={styles.textBlock}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {answerStats ? (
            <View style={styles.statsCard}>
              <StatRow
                label={t("revision.hub.sessionComplete.statReviewed")}
                value={answerStats.reviewed}
              />
              <StatRow
                label={t("revision.hub.sessionComplete.statKnow")}
                value={answerStats.knowCount}
              />
              <StatRow
                label={t("revision.hub.sessionComplete.statDontKnow")}
                value={answerStats.dontKnowCount}
              />
            </View>
          ) : null}

          {showDifficultSummary ? (
            <View style={styles.statsCard}>
              <StatRow
                label={t("revision.hub.sessionComplete.statMastered")}
                value={difficultSummary.mastered}
              />
              <StatRow
                label={t("revision.hub.sessionComplete.statStillDifficult")}
                value={difficultSummary.stillDifficult}
              />
            </View>
          ) : null}

          {noDifficultLeft ? (
            <Text style={styles.positiveNote}>
              {t("revision.hub.sessionComplete.noDifficultLeft")}
            </Text>
          ) : null}

          {showDailyStreak ? (
            <View style={styles.streakBlock}>
              <View
                style={styles.streakFireRow}
                accessibilityLabel={`Daily review streak ${dailyReviewStreak}`}
              >
                <Ionicons name="flame" size={22} color="#E65100" />
                <Text style={styles.streakFire}>
                  {t("revision.hub.sessionComplete.streakDays", {
                    count: dailyReviewStreak,
                  })}
                </Text>
              </View>
              {streakTrophyTitle ? (
                <View style={styles.streakTrophyRow}>
                  <Ionicons
                    name="trophy"
                    size={18}
                    color={StitchColors.secondary}
                  />
                  <Text style={styles.streakTrophyText}>{streakTrophyTitle}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.meta}>
            {t("revision.hub.sessionComplete.sessionTime", {
              duration: durationLabel,
            })}
          </Text>
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <Pressable
          android_ripple={ANDROID_RIPPLE_PRIMARY}
          style={({ pressed }) => [
            styles.primaryBtn,
            primarySolidPressStyle(pressed, false),
          ]}
          onPress={onBackToRevisionHub}
          accessibilityRole="button"
          accessibilityLabel={t("revision.hub.sessionComplete.backToHub")}
        >
          <Text style={styles.primaryBtnText}>
            {t("revision.hub.sessionComplete.backToHub")}
          </Text>
        </Pressable>
        {hasDifficultRemaining && onRepeatDifficultSession ? (
          <Pressable
            android_ripple={ANDROID_RIPPLE_SURFACE}
            style={({ pressed }) => [
              styles.secondaryBtn,
              surfacePressStyle(pressed, false),
            ]}
            onPress={onRepeatDifficultSession}
            accessibilityRole="button"
            accessibilityLabel={t("revision.hub.sessionComplete.repeatDifficult")}
          >
            <Text style={styles.secondaryBtnText}>
              {t("revision.hub.sessionComplete.repeatDifficult")}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          android_ripple={ANDROID_RIPPLE_SURFACE}
          style={({ pressed }) => [
            styles.secondaryBtn,
            surfacePressStyle(pressed, false),
          ]}
          onPress={onBackToHome}
          accessibilityRole="button"
          accessibilityLabel={t("revision.hub.sessionComplete.backToHome")}
        >
          <Text style={styles.secondaryBtnText}>
            {t("revision.hub.sessionComplete.backToHome")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: StitchColors.surface,
    alignItems: "stretch",
  },
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    gap: 20,
    minHeight: 0,
  },
  iconWrap: {
    alignSelf: "center",
    marginBottom: 4,
  },
  textBlock: {
    width: "100%",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 22,
  },
  statsCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLow,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statLabel: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
  },
  statValue: {
    fontSize: 17,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
  },
  positiveNote: {
    fontSize: 15,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.secondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  meta: {
    fontSize: 14,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    opacity: 0.9,
  },
  streakBlock: {
    alignItems: "center",
    gap: 8,
    width: "100%",
    paddingHorizontal: 8,
  },
  streakFireRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  streakFire: {
    fontSize: 17,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
    flexShrink: 1,
  },
  streakTrophyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  streakTrophyText: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    flexShrink: 1,
  },
  actions: {
    gap: 10,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    flexShrink: 0,
  },
  primaryBtn: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onPrimary,
  },
  secondaryBtn: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLow,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
  },
});
