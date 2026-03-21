import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { useDailyWord } from '@/src/features/dailyWord/useDailyWord';
import { canPronounce, speakWord } from '@/src/services/audio/pronunciationService';

export default function HomeScreen() {
  const router = useRouter();
  const { isLoading, profile, snapshot, canAct, markKnown, skipWord } = useDailyWord();
  const [showTranslation, setShowTranslation] = useState(false);
  const [showExample, setShowExample] = useState(false);

  const activeWord = snapshot?.activeWord;

  useEffect(() => {
    setShowTranslation(false);
    setShowExample(false);
  }, [activeWord?.id]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color="#111827" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Onboarding required</Text>
        <Text style={styles.subtitle}>Complete onboarding to start daily words.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/(onboarding)')}>
          <Text style={styles.primaryButtonText}>Go to onboarding</Text>
        </Pressable>
      </View>
    );
  }

  if (!activeWord) {
    const message =
      snapshot?.emptyReason === 'no-words-for-config'
        ? 'No words available for this language pair and level.'
        : 'All words from this bucket are completed. Great job.';

    return (
      <View style={styles.centered}>
        <Text style={styles.title}>No active word</Text>
        <Text style={styles.subtitle}>{message}</Text>
        <Text style={styles.metaText}>
          Known: {snapshot?.knownCount ?? 0} | Skipped: {snapshot?.skippedCount ?? 0}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.topLabel}>
        {profile.languagePair.sourceLanguage.toUpperCase()}
        {' -> '}
        {profile.languagePair.targetLanguage.toUpperCase()} | {profile.displayLevel}
      </Text>

      <View style={styles.card}>
        <Text style={styles.word}>{activeWord.sourceText}</Text>
        <Pressable
          style={[styles.audioButton, !canPronounce(activeWord) && styles.buttonDisabled]}
          onPress={() => speakWord(activeWord)}
          disabled={!canPronounce(activeWord)}>
          <Text style={styles.audioButtonText}>Play pronunciation</Text>
        </Pressable>
        <Pressable style={styles.revealButton} onPress={() => setShowTranslation((prev) => !prev)}>
          <Text style={styles.revealButtonText}>
            {showTranslation ? activeWord.targetText : 'Reveal translation'}
          </Text>
        </Pressable>
        <Pressable style={styles.revealButton} onPress={() => setShowExample((prev) => !prev)}>
          <Text style={styles.revealButtonText}>
            {showExample ? activeWord.exampleSource : 'Reveal example'}
          </Text>
        </Pressable>
        {showExample ? <Text style={styles.exampleMuted}>{activeWord.exampleTarget}</Text> : null}
      </View>

      <Text style={styles.metaText}>
        Remaining: {snapshot?.remainingCount ?? 0} / {snapshot?.totalCandidateCount ?? 0}
      </Text>

      <View style={styles.actions}>
        <Pressable style={[styles.secondaryButton, !canAct && styles.buttonDisabled]} onPress={skipWord}>
          <Text style={styles.secondaryButtonText}>Skip</Text>
        </Pressable>
        <Pressable style={[styles.primaryButton, !canAct && styles.buttonDisabled]} onPress={markKnown}>
          <Text style={styles.primaryButtonText}>Known</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  topLabel: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 8,
  },
  card: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    backgroundColor: '#ffffff',
  },
  word: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
  },
  revealButton: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  revealButtonText: {
    color: '#111827',
    fontWeight: '500',
  },
  audioButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
  },
  audioButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  exampleMuted: {
    fontSize: 14,
    color: '#6b7280',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#6b7280',
  },
  metaText: {
    color: '#6b7280',
  },
  actions: {
    marginTop: 'auto',
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#f9fafb',
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
