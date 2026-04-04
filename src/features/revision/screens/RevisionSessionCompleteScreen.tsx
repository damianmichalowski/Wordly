import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
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
  /** Daily Review session: updated streak count from the server. */
  dailyReviewStreak?: number;
  /** Optional streak-related trophy title to show inline (no separate popup). */
  streakTrophyTitle?: string;
};

export function RevisionSessionCompleteScreen({
  sessionStats,
  onBackToRevisionHub,
  onBackToHome,
  dailyReviewStreak,
  streakTrophyTitle,
}: RevisionSessionCompleteScreenProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    logger.info(LogTag.REVISION, "Completion screen opened");
  }, []);

  const durationLabel = formatSessionDurationMs(sessionStats.sessionDurationMs);
  const showDailyStreak =
    sessionStats.mode === "daily" && typeof dailyReviewStreak === "number";

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
            name="checkmark-circle"
            size={56}
            color={StitchColors.secondary}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(380).delay(60)}>
          <Text style={styles.title}>Nice work</Text>
          <Text style={styles.subtitle}>
            You reviewed {sessionStats.cardsReviewed}{" "}
            {sessionStats.cardsReviewed === 1 ? "word" : "words"}
          </Text>
          {showDailyStreak ? (
            <View style={styles.streakBlock}>
              <View
                style={styles.streakFireRow}
                accessibilityLabel={`Daily review streak ${dailyReviewStreak}`}
              >
                <Ionicons name="flame" size={22} color="#E65100" />
                <Text style={styles.streakFire}>
                  {dailyReviewStreak}{" "}
                  {dailyReviewStreak === 1 ? "day" : "days"} in a row
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
          <Text style={styles.meta}>Session time: {durationLabel}</Text>
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
          accessibilityLabel="Back to Revision Hub"
        >
          <Text style={styles.primaryBtnText}>Back to Revision Hub</Text>
        </Pressable>
        <Pressable
          android_ripple={ANDROID_RIPPLE_SURFACE}
          style={({ pressed }) => [
            styles.secondaryBtn,
            surfacePressStyle(pressed, false),
          ]}
          onPress={onBackToHome}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
        >
          <Text style={styles.secondaryBtnText}>Back to Home</Text>
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
  /** Ikona + teksty wyśrodkowane w pionie w wolnej przestrzeni nad przyciskami. */
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
  title: {
    fontSize: 28,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 17,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
  },
  meta: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    opacity: 0.9,
  },
  streakBlock: {
    marginTop: 14,
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
    paddingHorizontal: 4,
  },
  streakFire: {
    fontSize: 17,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
    textAlign: "left",
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
    gap: 12,
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
