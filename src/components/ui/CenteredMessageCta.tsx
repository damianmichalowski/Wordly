import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ANDROID_RIPPLE_PRIMARY,
  primarySolidPressStyle,
} from '@/src/components/ui/interaction';
import { StitchColors, StitchFonts, StitchRadius } from '@/src/theme/wordlyStitchTheme';

export type CenteredMessageCtaVariant = 'home' | 'settings' | 'revision';

type CenteredMessageCtaProps = {
  variant: CenteredMessageCtaVariant;
  title: string;
  subtitle: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
};

/**
 * Wspólny układ: wyśrodkowany komunikat + jeden CTA.
 * Warianty odwzorowują wcześniejsze style z `home` / `settings` / `revision` (bez zmiany wyglądu).
 */
export function CenteredMessageCta({
  variant,
  title,
  subtitle,
  primaryLabel,
  onPrimaryPress,
}: CenteredMessageCtaProps) {
  const s =
    variant === 'home' ? homeStyles : variant === 'settings' ? settingsStyles : revisionStyles;

  return (
    <View style={s.centered}>
      <Text style={s.title}>{title}</Text>
      <Text style={s.subtitle}>{subtitle}</Text>
      <Pressable
        android_ripple={ANDROID_RIPPLE_PRIMARY}
        style={({ pressed }) => [s.primaryButton, primarySolidPressStyle(pressed, false)]}
        onPress={onPrimaryPress}>
        <Text style={s.primaryButtonText}>{primaryLabel}</Text>
      </Pressable>
    </View>
  );
}

const centeredBase = {
  flex: 1,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  padding: 24,
  gap: 10,
  backgroundColor: StitchColors.surface,
};

/** Było: `app/(tabs)/home.tsx`, blok `!profile`. */
const homeStyles = StyleSheet.create({
  centered: centeredBase,
  title: {
    fontSize: 22,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    textAlign: 'center',
    color: StitchColors.onSurfaceVariant,
  },
  primaryButton: {
    alignSelf: 'stretch',
    maxWidth: 400,
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.xl,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonText: {
    color: StitchColors.onPrimary,
    fontFamily: StitchFonts.bodySemi,
    fontSize: 16,
  },
});

/** Było: `app/(tabs)/settings.tsx`, blok `!profile`. */
const settingsStyles = StyleSheet.create({
  centered: centeredBase,
  title: {
    fontSize: 26,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
  },
  primaryButton: {
    alignSelf: 'stretch',
    maxWidth: 400,
    marginTop: 'auto',
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonText: {
    color: StitchColors.onPrimary,
    fontFamily: StitchFonts.bodySemi,
  },
});

/** Było: `revisionScreenStyles`, blok brak profilu w `revision.tsx`. */
const revisionStyles = StyleSheet.create({
  centered: centeredBase,
  title: {
    fontSize: 22,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    textAlign: 'center',
    color: StitchColors.onSurfaceVariant,
  },
  primaryButton: {
    alignSelf: 'stretch',
    maxWidth: 400,
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonText: {
    color: StitchColors.onPrimary,
    fontFamily: StitchFonts.bodySemi,
  },
});
