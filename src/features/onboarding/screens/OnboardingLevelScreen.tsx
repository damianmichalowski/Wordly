import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supportedLanguages } from '@/src/constants/languages';
import { CEFR_TILE_COPY, RECOMMENDED_LEVEL } from '@/src/features/onboarding/cefrLevelCopy';
import { completeOnboardingFromDraft } from '@/src/features/onboarding/completeOnboarding';
import {
  ANDROID_RIPPLE_PRIMARY,
  primarySolidPressStyle,
} from '@/src/components/ui/interaction';
import { OnboardingStepChrome } from '@/src/features/onboarding/components/OnboardingStepChrome';
import { useOnboardingDraft } from '@/src/features/onboarding/OnboardingProvider';
import { useAppBootstrap } from '@/src/hooks/useAppBootstrap';
import { cefrLevels, type CefrLevel } from '@/src/types/cefr';
import { StitchColors, StitchFonts, StitchRadius } from '@/src/theme/wordlyStitchTheme';

const SCREEN_H_PAD = 24 * 2;
const TILE_GAP = 12;

export default function OnboardingLevelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { markOnboardingComplete } = useAppBootstrap();
  const { draft, setCurrentLevel, reset } = useOnboardingDraft();
  const [finishing, setFinishing] = useState(false);

  const tileWidth = useMemo(() => {
    const w = Dimensions.get('window').width;
    return (w - SCREEN_H_PAD - TILE_GAP) / 2;
  }, []);

  const targetName =
    supportedLanguages.find((l) => l.code === draft.targetLanguage)?.name ?? draft.targetLanguage;

  const finish = async () => {
    setFinishing(true);
    const result = await completeOnboardingFromDraft(draft, markOnboardingComplete);
    setFinishing(false);
    if (result.ok) {
      reset();
      router.replace('/(tabs)/home');
    }
  };

  return (
    <OnboardingStepChrome step={2} totalSteps={2}>
      <View style={styles.body}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollInner}>
          <View style={styles.headBlock}>
            <Text style={styles.kicker}>Your vocabulary level</Text>
            <Text style={styles.title}>
              Where are you with <Text style={styles.titleItalic}>{targetName}</Text>?
            </Text>
            <Text style={styles.lead}>
              We use CEFR so your daily word and deck difficulty match how strong your vocabulary is. Focus on
              words in context, not phrases or full sentences.
            </Text>
          </View>

          <View style={styles.tileGrid}>
            {cefrLevels.map((level) => (
              <LevelTile
                key={level}
                level={level}
                tileWidth={tileWidth}
                selected={draft.currentLevel === level}
                recommended={level === RECOMMENDED_LEVEL}
                onSelect={() => setCurrentLevel(level)}
              />
            ))}
          </View>
        </ScrollView>

        <Pressable
          android_ripple={ANDROID_RIPPLE_PRIMARY}
          style={({ pressed }) => [
            styles.primaryButton,
            { marginBottom: Math.max(insets.bottom, 10) },
            finishing && styles.primaryButtonDisabled,
            primarySolidPressStyle(pressed, finishing),
          ]}
          onPress={finish}
          disabled={finishing}>
          {finishing ? (
            <ActivityIndicator color={StitchColors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>Start learning</Text>
          )}
        </Pressable>
      </View>
    </OnboardingStepChrome>
  );
}

function LevelTile({
  level,
  tileWidth,
  selected,
  recommended,
  onSelect,
}: {
  level: CefrLevel;
  tileWidth: number;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  const copy = CEFR_TILE_COPY[level];

  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.tile,
        { width: tileWidth },
        selected && styles.tileSelected,
        recommended && styles.tileRecommended,
        pressed && styles.tilePressed,
      ]}>
      <View style={styles.tileTop}>
        <Text style={[styles.tileLevel, selected && styles.tileLevelSelected]}>{level}</Text>
        <Text style={styles.tileTitle}>{copy.title}</Text>
        <Text style={styles.tileSubtitle}>{copy.subtitle}</Text>
      </View>
      {recommended ? (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>Most popular</Text>
        </View>
      ) : null}
      {selected ? (
        <View style={styles.tileCheck}>
          <Ionicons name="checkmark-circle" size={22} color={StitchColors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollInner: {
    flexGrow: 1,
    paddingBottom: 16,
    gap: 20,
  },
  headBlock: {
    gap: 12,
    marginBottom: 4,
  },
  kicker: {
    fontSize: 11,
    fontFamily: StitchFonts.label,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    letterSpacing: -0.5,
  },
  titleItalic: {
    fontStyle: 'italic',
    color: StitchColors.primary,
  },
  lead: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    maxWidth: 440,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
  },
  tile: {
    flexDirection: 'column',
    minHeight: 168,
    padding: 18,
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileRecommended: {
    backgroundColor: StitchColors.surfaceContainerLow,
  },
  tileSelected: {
    borderColor: StitchColors.primary,
    shadowColor: StitchColors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  tilePressed: {
    opacity: 0.92,
  },
  tileTop: {
    flexGrow: 1,
  },
  popularBadge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 0,
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularBadgeText: {
    fontSize: 9,
    lineHeight: 28,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onPrimary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tileLevel: {
    fontSize: 32,
    lineHeight: 36,
    fontFamily: StitchFonts.display,
    color: StitchColors.surfaceContainerHighest,
    marginBottom: 8,
  },
  tileLevelSelected: {
    color: StitchColors.primary,
  },
  tileTitle: {
    fontSize: 16,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    marginBottom: 6,
  },
  tileSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
  },
  tileCheck: {
    position: 'absolute',
    top: 14,
    right: 12,
  },
  primaryButton: {
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.xl,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: StitchColors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: StitchColors.onPrimary,
    fontFamily: StitchFonts.bodySemi,
    fontSize: 17,
  },
});
