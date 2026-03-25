import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ANDROID_RIPPLE_PRIMARY,
  primarySolidPressStyle,
} from '@/src/components/ui/interaction';
import { supportedLanguages } from '@/src/constants/languages';
import { OnboardingStepChrome } from '@/src/features/onboarding/components/OnboardingStepChrome';
import { useOnboardingDraft } from '@/src/features/onboarding/OnboardingProvider';
import type { LanguageCode } from '@/src/types/language';
import { StitchColors, StitchFonts, StitchRadius } from '@/src/theme/wordlyStitchTheme';

type PickerSlot = 'source' | 'target' | null;

function LanguagePickerRow({
  languageCode,
  onPress,
  emphasized,
}: {
  languageCode: LanguageCode;
  onPress: () => void;
  emphasized?: boolean;
}) {
  const lang = supportedLanguages.find((l) => l.code === languageCode) ?? supportedLanguages[0];
  const codeLabel = languageCode.toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectorRow,
        emphasized && styles.selectorRowEmphasized,
        pressed && styles.selectorRowPressed,
      ]}>
      <View style={styles.selectorAvatar}>
        <Text style={styles.selectorAvatarText}>{codeLabel}</Text>
      </View>
      <View style={styles.selectorTextCol}>
        <Text style={styles.selectorTitle}>{lang.name}</Text>
        <Text style={styles.selectorSubtitle}>{lang.endonym}</Text>
      </View>
      <Ionicons
        name="chevron-down"
        size={22}
        color={emphasized ? StitchColors.primary : StitchColors.outlineVariant}
      />
    </Pressable>
  );
}

export default function OnboardingLanguagePairScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  const { draft, setSourceLanguage, setTargetLanguage } = useOnboardingDraft();
  const [picker, setPicker] = useState<PickerSlot>(null);

  const canContinue = draft.sourceLanguage !== draft.targetLanguage;

  const swapLanguages = () => {
    const s = draft.sourceLanguage;
    setSourceLanguage(draft.targetLanguage);
    setTargetLanguage(s);
  };

  const closePicker = () => setPicker(null);

  const applyLanguage = (code: LanguageCode) => {
    if (picker === 'source') {
      setSourceLanguage(code);
    } else if (picker === 'target') {
      setTargetLanguage(code);
    }
    closePicker();
  };

  const sourceBlock = (
    <View style={styles.langCol}>
      <Text style={styles.fieldLabel}>I speak</Text>
      <LanguagePickerRow languageCode={draft.sourceLanguage} onPress={() => setPicker('source')} />
    </View>
  );

  const targetBlock = (
    <View style={styles.langCol}>
      <Text style={styles.fieldLabel}>I&apos;m learning</Text>
      <LanguagePickerRow
        languageCode={draft.targetLanguage}
        onPress={() => setPicker('target')}
        emphasized
      />
    </View>
  );

  const swapFab = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Swap languages"
      style={({ pressed }) => [styles.swapFab, pressed && styles.swapFabPressed]}
      onPress={swapLanguages}>
      <Ionicons name="swap-horizontal" size={24} color={StitchColors.primary} />
    </Pressable>
  );

  return (
    <OnboardingStepChrome step={1} totalSteps={2}>
      <View style={styles.root}>
        <View style={styles.blobTop} pointerEvents="none" />
        <View style={styles.blobBottom} pointerEvents="none" />

        <Modal visible={picker !== null} animationType="fade" transparent onRequestClose={closePicker}>
          <Pressable style={styles.modalBackdrop} onPress={closePicker}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>
                {picker === 'source' ? 'Native language' : 'Learning language'}
              </Text>
              {supportedLanguages.map((item) => (
                <Pressable
                  key={item.code}
                  style={({ pressed }) => [styles.modalRow, pressed && styles.modalRowPressed]}
                  onPress={() => applyLanguage(item.code)}>
                  <Text style={styles.modalRowTitle}>{item.name}</Text>
                  <Text style={styles.modalRowSub}>{item.endonym}</Text>
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>

        <View style={styles.body}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollInner}>
            <View style={styles.headBlock}>
              <Text style={styles.title}>
                Your linguistic <Text style={styles.titleAccent}>bridge.</Text>
              </Text>
              <Text style={styles.lead}>
                Select the native language you&apos;re comfortable with and the target language you want to
                master.
              </Text>
            </View>

            {isWide ? (
              <View style={styles.wideRow}>
                <View style={styles.wideCol}>{sourceBlock}</View>
                <View style={styles.swapSlot}>{swapFab}</View>
                <View style={styles.wideCol}>{targetBlock}</View>
              </View>
            ) : (
              <>
                {sourceBlock}
                <View style={styles.swapSlotNarrow}>{swapFab}</View>
                {targetBlock}
              </>
            )}

            {!canContinue ? (
              <Text style={styles.warning}>Pick two different languages to continue.</Text>
            ) : null}
          </ScrollView>

          <Pressable
            onPress={() => router.push('/(onboarding)/level')}
            android_ripple={ANDROID_RIPPLE_PRIMARY}
            style={({ pressed }) => [
              styles.primaryButton,
              { marginBottom: Math.max(insets.bottom, 10) },
              !canContinue && styles.primaryButtonDisabled,
              primarySolidPressStyle(pressed, !canContinue),
            ]}
            disabled={!canContinue}>
            <Text style={styles.primaryButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color={StitchColors.onPrimary} />
          </Pressable>
        </View>
      </View>
    </OnboardingStepChrome>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  blobTop: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(68, 86, 186, 0.07)',
  },
  blobBottom: {
    position: 'absolute',
    bottom: -72,
    left: -72,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(40, 108, 52, 0.06)',
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollInner: {
    flexGrow: 1,
    paddingBottom: 16,
    gap: 22,
  },
  headBlock: {
    gap: 14,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    letterSpacing: -0.6,
  },
  titleAccent: {
    fontStyle: 'italic',
    color: StitchColors.secondary,
  },
  lead: {
    fontSize: 17,
    lineHeight: 26,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    maxWidth: 520,
  },
  wideRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  wideCol: {
    flex: 1,
    minWidth: 0,
  },
  langCol: {
    gap: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: StitchFonts.label,
    fontWeight: '600',
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    paddingLeft: 6,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLow,
  },
  selectorRowEmphasized: {
    backgroundColor: StitchColors.surfaceContainerLow,
    borderWidth: 2,
    borderColor: 'rgba(68, 86, 186, 0.22)',
  },
  selectorRowPressed: {
    backgroundColor: StitchColors.surfaceContainerLowest,
  },
  selectorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: StitchColors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  selectorAvatarText: {
    fontSize: 11,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  selectorTextCol: {
    flex: 1,
    minWidth: 0,
  },
  selectorTitle: {
    fontSize: 17,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    marginBottom: 2,
  },
  selectorSubtitle: {
    fontSize: 12,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
  },
  swapSlot: {
    paddingBottom: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapSlotNarrow: {
    alignItems: 'center',
    marginVertical: 4,
  },
  swapFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: StitchColors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: StitchColors.onSurface,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  swapFabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  warning: {
    fontFamily: StitchFonts.body,
    color: StitchColors.error,
    fontSize: 14,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.lg,
    paddingVertical: 18,
    paddingHorizontal: 24,
    shadowColor: StitchColors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: StitchColors.onPrimary,
    fontFamily: StitchFonts.headline,
    fontSize: 18,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 20, 25, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    paddingVertical: 12,
    paddingHorizontal: 8,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    gap: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  modalRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: StitchRadius.md,
  },
  modalRowPressed: {
    backgroundColor: StitchColors.surfaceContainerLow,
  },
  modalRowTitle: {
    fontSize: 16,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
  },
  modalRowSub: {
    fontSize: 13,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    marginTop: 2,
  },
});
