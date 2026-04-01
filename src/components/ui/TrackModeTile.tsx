import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ANDROID_RIPPLE_SURFACE } from "@/src/components/ui/interaction";
import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

export type TrackModeTileProps = {
  title: string;
  description?: string | null;
  selected: boolean;
  disabled: boolean;
  availableCount: number;
  pct: number;
  barFill: number;
  width: number;
  onPress: () => void;
  /**
   * `true` (domyślnie): pasek + „% · N słów” jak w ustawieniach.
   * `false`: tylko liczba słów (onboarding), bez procentów i bez paska.
   */
  showLearningProgress?: boolean;
};

export function TrackModeTile({
  title,
  description,
  selected,
  disabled,
  availableCount,
  pct,
  barFill,
  width,
  onPress,
  showLearningProgress = true,
}: TrackModeTileProps) {
  const hasBar = showLearningProgress && availableCount > 0;
  const meta =
    availableCount > 0
      ? showLearningProgress
        ? `${pct}% · ${availableCount} słów`
        : `${availableCount} słów`
      : "Brak słów";

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      android_ripple={ANDROID_RIPPLE_SURFACE}
      style={({ pressed }) => [
        styles.root,
        { width, flexShrink: 0 },
        selected && styles.rootSelected,
        pressed && !disabled && styles.rootPressed,
        disabled && styles.rootDisabled,
      ]}
    >
      <View style={styles.titleRow}>
        <Text
          style={[styles.title, selected && styles.titleWithCheck]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {selected ? (
          <View style={styles.checkFloating} pointerEvents="none">
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={StitchColors.primary}
            />
          </View>
        ) : null}
      </View>

      {description ? (
        <Text style={styles.desc} numberOfLines={2}>
          {description}
        </Text>
      ) : (
        <View style={styles.descSpacer} />
      )}

      {hasBar ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${barFill}%` }]} />
        </View>
      ) : (
        <View style={styles.trackPlaceholder} />
      )}

      <Text style={styles.meta}>{meta}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 148,
    padding: 14,
    borderRadius: StitchRadius.xl,
    backgroundColor: StitchColors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: "rgba(175, 179, 179, 0.35)",
    gap: 8,
    shadowColor: StitchColors.onSurface,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  rootSelected: {
    borderColor: "rgba(68, 86, 186, 0.55)",
    shadowOpacity: 0.07,
    elevation: 2,
  },
  rootPressed: {
    opacity: 0.94,
  },
  rootDisabled: {
    opacity: 0.5,
  },
  /** Checkmark w rogu (jak wcześniej); mniejsza ikona (18) = mniejszy padding niż przy 22px. */
  titleRow: {
    position: "relative",
    width: "100%",
    minHeight: 22,
  },
  title: {
    width: "100%",
    fontSize: 16,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  titleWithCheck: {
    paddingRight: 22,
  },
  checkFloating: {
    position: "absolute",
    top: 0,
    right: 0,
  },
  desc: {
    fontSize: 12,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    lineHeight: 17,
    minHeight: 34,
  },
  descSpacer: {
    minHeight: 34,
  },
  track: {
    height: 6,
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainerHigh,
    overflow: "hidden",
  },
  trackPlaceholder: {
    height: 6,
  },
  fill: {
    height: "100%",
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.secondary,
  },
  meta: {
    fontSize: 11,
    fontFamily: StitchFonts.label,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 0.2,
    marginTop: 2,
  },
});
