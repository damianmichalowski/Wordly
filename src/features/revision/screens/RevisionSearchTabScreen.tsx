import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';

import { CenteredMessageCta } from '@/src/components/ui/CenteredMessageCta';
import { RevisionFlashcardMode } from '@/src/features/revision/components/RevisionFlashcardMode';
import { RevisionKnownWordsList } from '@/src/features/revision/components/RevisionKnownWordsList';
import { revisionScreenStyles } from '@/src/features/revision/revisionScreenStyles';
import { useRevision } from '@/src/features/revision/useRevision';
import { StitchColors } from '@/src/theme/wordlyStitchTheme';

/**
 * Zakładka Search: wyszukiwarka, filtry i pełna lista znanych słów (biblioteka).
 */
export default function RevisionSearchTabScreen() {
  const router = useRouter();
  const {
    isLoading,
    profile,
    knownWords,
    sortPrefs,
    setRevisionSortPrefs,
    mode,
    flashDeck,
    index,
    isFlipped,
    activeCard,
    startFlashcards,
    exitFlashcards,
    flip,
    next,
    previous,
  } = useRevision({ variant: 'library' });

  if (isLoading) {
    return (
      <View style={revisionScreenStyles.centered}>
        <ActivityIndicator size="small" color={StitchColors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <CenteredMessageCta
        variant="revision"
        title="Wymagany onboarding"
        subtitle="Ukończ onboarding, aby przeglądać bibliotekę."
        primaryLabel="Przejdź do onboardingu"
        onPrimaryPress={() => router.replace('/(onboarding)')}
      />
    );
  }

  if (mode === 'flashcards') {
    return (
      <RevisionFlashcardMode
        flashDeck={flashDeck}
        index={index}
        activeCard={activeCard}
        isFlipped={isFlipped}
        onAbortSession={exitFlashcards}
        flip={flip}
        next={next}
        previous={previous}
      />
    );
  }

  return (
    <RevisionKnownWordsList
      knownWords={knownWords}
      sortPrefs={sortPrefs}
      onSortPrefsChange={setRevisionSortPrefs}
      onStartFlashcards={startFlashcards}
      onOpenWord={(w) => router.push(`/word/${w.id}?from=library`)}
      showUnlockEmptyState
      onUnlockPrimaryPress={() => router.push('/(tabs)/home')}
      headerTitle="Biblioteka"
      showFlashcardHero={false}
    />
  );
}
