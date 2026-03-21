import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { supportedLanguages } from '@/src/constants/languages';
import { useOnboardingDraft } from '@/src/features/onboarding/OnboardingProvider';

export default function OnboardingLanguagePairScreen() {
  const router = useRouter();
  const { draft, setSourceLanguage, setTargetLanguage } = useOnboardingDraft();

  const canContinue = draft.sourceLanguage !== draft.targetLanguage;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Choose language pair</Text>

      <Text style={styles.label}>Native language</Text>
      <View style={styles.chips}>
        {supportedLanguages.map((language) => (
          <LanguageChip
            key={`source-${language.code}`}
            label={language.name}
            active={draft.sourceLanguage === language.code}
            onPress={() => setSourceLanguage(language.code)}
          />
        ))}
      </View>

      <Text style={styles.label}>Target language</Text>
      <View style={styles.chips}>
        {supportedLanguages.map((language) => (
          <LanguageChip
            key={`target-${language.code}`}
            label={language.name}
            active={draft.targetLanguage === language.code}
            onPress={() => setTargetLanguage(language.code)}
          />
        ))}
      </View>

      {!canContinue ? (
        <Text style={styles.warning}>Source and target language must be different.</Text>
      ) : null}

      <Pressable
        onPress={() => router.push('/(onboarding)/level')}
        style={[styles.button, !canContinue && styles.buttonDisabled]}
        disabled={!canContinue}>
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

type LanguageChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function LanguageChip({ label, active, onPress }: LanguageChipProps) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  label: {
    marginTop: 8,
    fontSize: 14,
    color: '#4b5563',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  chipActive: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  chipText: {
    color: '#111827',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#f9fafb',
  },
  warning: {
    color: '#b45309',
    marginTop: 8,
  },
  button: {
    marginTop: 'auto',
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: '#f9fafb',
    fontWeight: '600',
  },
});
