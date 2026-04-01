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

// TODO: integrate revision stats update when stats system is implemented

export type RevisionSessionCompleteScreenProps = {
  sessionStats: RevisionSessionCompletionStats;
  onBackToRevisionHub: () => void;
  onBackToHome: () => void;
};

export function RevisionSessionCompleteScreen({
  sessionStats,
  onBackToRevisionHub,
  onBackToHome,
}: RevisionSessionCompleteScreenProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    logger.info(LogTag.REVISION, "Completion screen opened");
  }, []);

  const durationLabel = formatSessionDurationMs(sessionStats.sessionDurationMs);

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
