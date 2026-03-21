import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { supportedLanguages } from '@/src/constants/languages';
import { deriveDisplayLevel } from '@/src/domain/userProfile/levelMapping';
import { useOnboardingDraft } from '@/src/features/onboarding/OnboardingProvider';
import { useAppBootstrap } from '@/src/hooks/useAppBootstrap';
import { upsertProfileToSupabase } from '@/src/services/api/profileApi';
import { setOnboardingComplete } from '@/src/services/storage/onboardingStorage';
import { saveUserProfile } from '@/src/services/storage/profileStorage';
import type { UserProfile } from '@/src/types/profile';

export default function OnboardingSummaryScreen() {
  const router = useRouter();
  const { markOnboardingComplete } = useAppBootstrap();
  const { draft, reset } = useOnboardingDraft();

  const displayLevel = deriveDisplayLevel(draft.currentLevel, draft.displayLevelPolicy);

  const sourceLanguageName =
    supportedLanguages.find((item) => item.code === draft.sourceLanguage)?.name ?? draft.sourceLanguage;
  const targetLanguageName =
    supportedLanguages.find((item) => item.code === draft.targetLanguage)?.name ?? draft.targetLanguage;

  const handleFinish = async () => {
    const now = new Date().toISOString();
    const profile: UserProfile = {
      userId: 'local-user',
      languagePair: {
        sourceLanguage: draft.sourceLanguage,
        targetLanguage: draft.targetLanguage,
      },
      currentLevel: draft.currentLevel,
      displayLevel,
      displayLevelPolicy: draft.displayLevelPolicy,
      createdAt: now,
      updatedAt: now,
    };

    await saveUserProfile(profile);
    await upsertProfileToSupabase(profile);
    await setOnboardingComplete();
    markOnboardingComplete();
    reset();
    router.replace('/(tabs)/home');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Your plan is ready</Text>
      <View style={styles.card}>
        <Row label="Native language" value={sourceLanguageName} />
        <Row label="Target language" value={targetLanguageName} />
        <Row label="Current level" value={draft.currentLevel} />
        <Row label="Display level (MVP)" value={displayLevel} />
      </View>
      <Pressable style={styles.button} onPress={handleFinish}>
        <Text style={styles.buttonText}>Finish onboarding</Text>
      </Pressable>
    </View>
  );
}

type RowProps = {
  label: string;
  value: string;
};

function Row({ label, value }: RowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    color: '#6b7280',
  },
  rowValue: {
    fontWeight: '600',
    color: '#111827',
  },
  button: {
    marginTop: 'auto',
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#f9fafb',
    fontWeight: '600',
  },
});
