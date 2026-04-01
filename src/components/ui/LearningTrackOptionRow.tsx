import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ANDROID_RIPPLE_SURFACE } from "@/src/components/ui/interaction";
import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

export type LearningTrackOptionRowProps = {
  title: string;
  /** Category / long labels: allow 2 lines. Difficulty: default 1. */
  description?: string | null;
  availableCount: number;
  /** Rounded percent for label (honest value). */
  learnedPct: number;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  titleNumberOfLines?: number;
};

/**
 * Szerokość wypełnienia paska (0-100): przy 0% i dostępnych słowach, 1% (motywacja); 100%, pełny pasek.
 */
export function progressBarFillPercent(
  actualPct: number,
  availableCount: number,
): number {
  if (availableCount <= 0) {
    return 0;
  }
  if (actualPct >= 100) {
    return 100;
  }
  if (actualPct <= 0) {
    return 1;
  }
  return actualPct;
}

export function LearningTrackOptionRow({
  title,
  description,
  availableCount,
  learnedPct,
  selected,
  disabled,
  onPress,
  titleNumberOfLines = 1,
}: LearningTrackOptionRowProps) {
  const barFill = progressBarFillPercent(learnedPct, availableCount);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      android_ripple={ANDROID_RIPPLE_SURFACE}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && !disabled && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
    >
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={titleNumberOfLines}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        {availableCount > 0 ? (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${barFill}%` }]} />
          </View>
        ) : null}
        <Text style={styles.meta}>
          {availableCount} words · {learnedPct}% learned
        </Text>
      </View>
      {selected ? (
        <Ionicons
          name="checkmark-circle"
          size={22}
          color={StitchColors.primary}
        />
      ) : (
        <Ionicons
          name="ellipse-outline"
          size={22}
          color={StitchColors.outlineVariant}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowSelected: {
    borderColor: "rgba(68, 86, 186, 0.35)",
    backgroundColor: "rgba(68, 86, 186, 0.08)",
  },
  rowPressed: {
    opacity: 0.92,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    letterSpacing: -0.2,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
  },
  meta: {
    fontFamily: StitchFonts.body,
    fontSize: 12,
    color: StitchColors.onSurfaceVariant,
  },
  track: {
    height: 6,
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainerHigh,
    overflow: "hidden",
    marginTop: 2,
  },
  fill: {
    height: "100%",
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.secondary,
  },
});
