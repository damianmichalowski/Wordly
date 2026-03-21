import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cefrLevels } from '@/src/types/cefr';
import { useOnboardingDraft } from '@/src/features/onboarding/OnboardingProvider';

export default function OnboardingLevelScreen() {
  const router = useRouter();
  const { draft, setCurrentLevel } = useOnboardingDraft();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Your current proficiency</Text>
      <Text style={styles.caption}>MVP rule: we will show words one level above your current level.</Text>

      <View style={styles.levelGrid}>
        {cefrLevels.map((level) => (
          <Pressable
            key={level}
            onPress={() => setCurrentLevel(level)}
            style={[styles.levelButton, draft.currentLevel === level && styles.levelButtonActive]}>
            <Text style={[styles.levelText, draft.currentLevel === level && styles.levelTextActive]}>
              {level}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.button} onPress={() => router.push('/(onboarding)/summary')}>
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </View>
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
  },
  caption: {
    color: '#6b7280',
    fontSize: 14,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  levelButton: {
    width: 84,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelButtonActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  levelText: {
    fontWeight: '600',
    color: '#111827',
  },
  levelTextActive: {
    color: '#f9fafb',
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
