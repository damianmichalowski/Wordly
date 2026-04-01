import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  surfacePressStyle,
} from '@/src/components/ui/interaction';
import { StitchColors, StitchFonts, StitchRadius } from '@/src/theme/wordlyStitchTheme';

export type SelectionChipProps = {
  label: string;
  meta?: string;
  tag?: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * Pill-style toggle used for language / level / policy choices.
 * Visuals match the Wordly “Stitch” theme used in onboarding and settings.
 */
export function SelectionChip({
  label,
  meta,
  tag,
  active,
  onPress,
  disabled,
}: SelectionChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={active ? ANDROID_RIPPLE_PRIMARY : ANDROID_RIPPLE_SURFACE}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        disabled && styles.chipDisabled,
        surfacePressStyle(pressed, Boolean(disabled)),
      ]}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.chipText, active && styles.chipTextActive]}>
            {label}
          </Text>
          {tag ? (
            <View style={[styles.tag, active && styles.tagActive]}>
              <Text style={[styles.tagText, active && styles.tagTextActive]}>
                {tag}
              </Text>
            </View>
          ) : null}
        </View>
        {meta ? (
          <Text style={[styles.metaText, active && styles.metaTextActive]}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  content: {
    gap: 2,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  chipActive: {
    backgroundColor: StitchColors.primary,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurface,
  },
  chipTextActive: {
    color: StitchColors.onPrimary,
  },
  metaText: {
    fontFamily: StitchFonts.body,
    fontSize: 12,
    color: StitchColors.onSurfaceVariant,
  },
  metaTextActive: {
    color: StitchColors.onPrimary,
    opacity: 0.85,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainerLowest,
  },
  tagActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  tagText: {
    fontFamily: StitchFonts.label,
    fontSize: 11,
    color: StitchColors.onSurfaceVariant,
  },
  tagTextActive: {
    color: StitchColors.onPrimary,
  },
});
