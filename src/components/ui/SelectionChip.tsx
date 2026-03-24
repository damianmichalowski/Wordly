import { Pressable, StyleSheet, Text } from 'react-native';

import { StitchColors, StitchFonts, StitchRadius } from '@/src/theme/wordlyStitchTheme';

export type SelectionChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * Pill-style toggle used for language / level / policy choices.
 * Visuals match the Wordly “Stitch” theme used in onboarding and settings.
 */
export function SelectionChip({ label, active, onPress, disabled }: SelectionChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainerHigh,
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
});
