import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
    ANDROID_RIPPLE_SURFACE,
    surfacePressStyle,
} from "@/src/components/ui/interaction";
import type { UserAchievementRow } from "@/src/features/achievements/services/achievements.service";
import { resolveAchievementIonicon } from "@/src/features/achievements/utils/resolveAchievementIonicon";
import {
    StitchColors,
    StitchFonts,
    StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

export function SettingsTrophyCard({
  row,
  compact,
  fullWidth,
  onPress,
}: {
  row: UserAchievementRow;
  compact?: boolean;
  fullWidth?: boolean;
  onPress: () => void;
}) {
  const locked = !row.unlocked;
  const pct = Math.round(Math.min(1, row.progressRatio) * 100);
  const iconName = resolveAchievementIonicon(row);
  return (
    <Pressable
      onPress={onPress}
      android_ripple={ANDROID_RIPPLE_SURFACE}
      style={({ pressed }) => [
        styles.trophyCard,
        compact && styles.trophyCardCompact,
        fullWidth && styles.trophyCardFull,
        locked && styles.trophyCardLocked,
        surfacePressStyle(pressed, false),
      ]}
    >
      <View style={[styles.trophyIconWrap, locked && styles.trophyIconLocked]}>
        <Ionicons
          name={iconName}
          size={compact ? 22 : 26}
          color={
            locked ? StitchColors.onSurfaceVariant : StitchColors.secondary
          }
        />
      </View>
      <Text style={styles.trophyTitle} numberOfLines={2}>
        {row.definition.title}
      </Text>
      {locked ? (
        <Text style={styles.trophyMeta}>
          {row.progressCurrent}/{row.definition.threshold}
        </Text>
      ) : (
        <Text style={styles.trophyUnlocked}>Unlocked</Text>
      )}
      {locked ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trophyCard: {
    width: 132,
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLow,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: `${StitchColors.outlineVariant}33`,
  },
  trophyCardCompact: {
    width: 120,
  },
  trophyCardFull: {
    width: "100%",
    alignSelf: "stretch",
  },
  trophyCardLocked: {
    opacity: 0.92,
  },
  trophyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255, 193, 7, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  trophyIconLocked: {
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  trophyTitle: {
    fontSize: 13,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
    minHeight: 36,
  },
  trophyMeta: {
    fontSize: 12,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
  },
  trophyUnlocked: {
    fontSize: 12,
    fontFamily: StitchFonts.bodySemi,
    color: "#286C34",
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: StitchColors.surfaceContainerHigh,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: StitchColors.primary,
    borderRadius: 2,
  },
});
