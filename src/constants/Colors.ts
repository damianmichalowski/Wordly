import { StitchColors } from '@/src/theme/wordlyStitchTheme';

const tintLight = StitchColors.primary;
const tintDark = StitchColors.primaryContainer;

/** Kolory pomocnicze (np. ikony tabów), zsynchronizowane ze Stitch. */
export default {
  light: {
    text: StitchColors.onSurface,
    background: StitchColors.surface,
    tint: tintLight,
    tabIconDefault: StitchColors.outlineVariant,
    tabIconSelected: tintLight,
  },
  dark: {
    text: '#f2f4f4',
    background: '#121418',
    tint: tintDark,
    tabIconDefault: '#6b7280',
    tabIconSelected: tintDark,
  },
};
