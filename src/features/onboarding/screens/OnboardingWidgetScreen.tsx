import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { completeOnboardingFromDraft } from '@/src/features/onboarding/completeOnboarding';
import { OnboardingStepChrome } from '@/src/features/onboarding/components/OnboardingStepChrome';
import { useOnboardingDraft } from '@/src/features/onboarding/OnboardingProvider';
import {
  ANDROID_RIPPLE_PRIMARY,
  primarySolidPressStyle,
} from '@/src/components/ui/interaction';
import { WidgetHomePreviewCard } from '@/src/components/ui/WidgetHomePreviewCard';
import { useAppBootstrap } from '@/src/hooks/useAppBootstrap';
import { StitchColors, StitchFonts, StitchRadius } from '@/src/theme/wordlyStitchTheme';
import { logUserAction } from '@/src/utils/userActionLog';

const PREVIEW_WORD = 'Hello';
const PREVIEW_TRANSLATIONS = ['cześć'];

export default function OnboardingWidgetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { markOnboardingComplete } = useAppBootstrap();
  const { draft, reset } = useOnboardingDraft();
  const [finishing, setFinishing] = useState(false);

  const widgetSize = useMemo(
    () => Math.min(228, Math.max(168, width - 56)),
    [width],
  );

  const canFinish = useMemo(() => {
    if (
      !draft.nativeLanguageId ||
      !draft.learningLanguageId ||
      draft.nativeLanguageId === draft.learningLanguageId
    ) {
      return false;
    }
    if (draft.learningModeType === 'difficulty' && !draft.learningLevel) {
      return false;
    }
    if (draft.learningModeType === 'category' && !draft.selectedCategoryId) {
      return false;
    }
    return true;
  }, [
    draft.learningLanguageId,
    draft.learningLevel,
    draft.learningModeType,
    draft.nativeLanguageId,
    draft.selectedCategoryId,
  ]);

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
    <OnboardingStepChrome step={3} totalSteps={3}>
      <View style={styles.body}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollInner}>
          <View style={styles.marketingHeader}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Zalecane</Text>
            </View>
            <Text style={styles.title}>Widżet na ekranie głównym</Text>

            <View style={styles.emotionBlock}>
              <View style={styles.accentBar} />
              <View style={styles.emotionCopy}>
                <Text style={styles.hook}>
                  Ile razy dziennie{'\n'}
                  zerkasz na telefon{'\n'}
                  <Text style={styles.hookEmphasis}>bez konkretnego powodu?</Text>
                </Text>
                <Text style={styles.lead}>
                  Nie tylko ty tak masz. To normalne. Możesz wykorzystać te momenty na poznanie{' '}
                  <Text style={styles.leadHighlight}>nowych słów</Text>.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>Podgląd widżetu</Text>
            <View style={styles.previewCanvas}>
              <WidgetHomePreviewCard
                word={PREVIEW_WORD}
                translations={PREVIEW_TRANSLATIONS}
                size={widgetSize}
              />
            </View>
          </View>
        </ScrollView>

        <Pressable
          android_ripple={ANDROID_RIPPLE_PRIMARY}
          style={({ pressed }) => [
            styles.primaryButton,
            { marginBottom: Math.max(insets.bottom, 10) },
            (!canFinish || finishing) && styles.primaryButtonDisabled,
            primarySolidPressStyle(pressed, !canFinish || finishing),
          ]}
          onPress={() => {
            logUserAction('button_press', {
              target: 'onboarding_finish_start_learning',
            });
            void finish();
          }}
          disabled={!canFinish || finishing}>
          {finishing ? (
            <ActivityIndicator color={StitchColors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>Zaczynam naukę</Text>
          )}
        </Pressable>
      </View>
    </OnboardingStepChrome>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollInner: {
    flexGrow: 1,
    paddingBottom: 20,
    gap: 22,
  },
  marketingHeader: {
    gap: 16,
  },
  emotionBlock: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
    marginTop: 2,
  },
  accentBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(68, 86, 186, 0.55)',
    minHeight: 72,
  },
  emotionCopy: {
    flex: 1,
    gap: 12,
    minWidth: 0,
    paddingTop: 2,
  },
  hook: {
    fontSize: 21,
    lineHeight: 28,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    letterSpacing: -0.35,
  },
  hookEmphasis: {
    fontFamily: StitchFonts.headline,
    fontStyle: 'italic',
    color: StitchColors.primary,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: StitchRadius.full,
    backgroundColor: 'rgba(68, 86, 186, 0.14)',
  },
  badgeText: {
    fontSize: 11,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    letterSpacing: -0.4,
  },
  lead: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
  },
  leadHighlight: {
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
  },
  previewSection: {
    gap: 14,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 10,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: 'uppercase',
    alignSelf: 'center',
  },
  previewCanvas: {
    borderRadius: StitchRadius.lg,
    borderWidth: 2,
    borderColor: 'rgba(175, 179, 179, 0.35)',
    backgroundColor: StitchColors.surfaceContainerLow,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
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
