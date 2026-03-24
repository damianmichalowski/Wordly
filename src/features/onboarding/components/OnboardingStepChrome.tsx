import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StitchColors, StitchFonts, StitchRadius } from '@/src/theme/wordlyStitchTheme';

type Props = {
  step: number;
  totalSteps: number;
  children: React.ReactNode;
};

export function OnboardingStepChrome({ step, totalSteps, children }: Props) {
  const insets = useSafeAreaInsets();
  const progress = totalSteps > 0 ? step / totalSteps : 0;

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.headerPad}>
        <View style={styles.topBar}>
          <Text style={styles.wordmark}>Wordly</Text>
          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.stepLabel}>
              Step {step} of {totalSteps}
            </Text>
          </View>
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: StitchColors.surface,
  },
  /** Tylko nagłówek ma padding boczny; treść kroków może być full-bleed (np. grafika). */
  headerPad: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  wordmark: {
    fontSize: 20,
    fontFamily: StitchFonts.display,
    color: StitchColors.primary,
    letterSpacing: -0.3,
  },
  progressBlock: {
    flex: 1,
    maxWidth: 200,
    alignItems: 'flex-end',
    gap: 6,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainerHighest,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.primary,
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: StitchFonts.label,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
