import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useRevision } from '@/src/features/revision/useRevision';
import { canPronounce, speakWord } from '@/src/services/audio/pronunciationService';

export default function RevisionScreen() {
  const router = useRouter();
  const { isLoading, profile, cards, index, isFlipped, activeCard, flip, next, previous } = useRevision();

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
        <Text style={styles.subtitle}>Complete onboarding to unlock revision mode.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/(onboarding)')}>
          <Text style={styles.primaryButtonText}>Go to onboarding</Text>
        </Pressable>
      </View>
    );
  }

  if (!activeCard) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>No cards yet</Text>
        <Text style={styles.subtitle}>Mark words as known in Daily to build your revision deck.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.caption}>
        Card {index + 1} of {cards.length}
      </Text>
      <Pressable style={styles.card} onPress={flip}>
        {!isFlipped ? (
          <>
            <Text style={styles.label}>Front</Text>
            <Text style={styles.word}>{activeCard.sourceText}</Text>
            <Pressable
              style={[styles.audioButton, !canPronounce(activeCard) && styles.buttonDisabled]}
              onPress={() => speakWord(activeCard)}
              disabled={!canPronounce(activeCard)}>
              <Text style={styles.audioButtonText}>Play pronunciation</Text>
            </Pressable>
            <Text style={styles.hint}>Tap to reveal</Text>
          </>
        ) : (
          <>
            <Text style={styles.label}>Back</Text>
            <Text style={styles.word}>{activeCard.targetText}</Text>
            <Pressable
              style={[styles.audioButton, !canPronounce(activeCard) && styles.buttonDisabled]}
              onPress={() => speakWord(activeCard)}
              disabled={!canPronounce(activeCard)}>
              <Text style={styles.audioButtonText}>Play pronunciation</Text>
            </Pressable>
            <Text style={styles.example}>{activeCard.exampleSource}</Text>
            <Text style={styles.exampleMuted}>{activeCard.exampleTarget}</Text>
          </>
        )}
      </Pressable>
      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={previous}>
          <Text style={styles.secondaryButtonText}>Previous</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={next}>
          <Text style={styles.primaryButtonText}>Next</Text>
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
  caption: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 8,
  },
  card: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 18,
    gap: 8,
    minHeight: 280,
    justifyContent: 'center',
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
  label: {
    color: '#6b7280',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  word: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
  },
  hint: {
    color: '#6b7280',
    marginTop: 8,
  },
  audioButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    marginTop: 4,
  },
  audioButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  example: {
    marginTop: 4,
    color: '#374151',
    fontSize: 14,
  },
  exampleMuted: {
    color: '#6b7280',
    fontSize: 14,
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
