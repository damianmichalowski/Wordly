import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';

import { CenteredMessageCta } from '@/src/components/ui/CenteredMessageCta';
import { RevisionFlashcardMode } from '@/src/features/revision/components/RevisionFlashcardMode';
import { RevisionHub } from '@/src/features/revision/components/RevisionHub';
import { RevisionKnownWordsList } from '@/src/features/revision/components/RevisionKnownWordsList';
import {
  getFlashSessionLabel,
  getSessionScreenTitle,
} from '@/src/features/revision/revisionSessionUi';
import { revisionScreenStyles } from '@/src/features/revision/revisionScreenStyles';
import { useRevision } from '@/src/features/revision/useRevision';
import { StitchColors } from '@/src/theme/wordlyStitchTheme';

/**
 * Zakładka Revision Hub: tryby powtórki (bento); bez listy biblioteki (ta jest w zakładce Search).
 */
export default function RevisionHubTabScreen() {
  const router = useRouter();
  const {
    isLoading,
    profile,
    knownWords,
    sortPrefs,
    setRevisionSortPrefs,
    sessionPhase,
    sessionConfig,
    enterSession,
    exitSessionToHub,
    hubCounts,
    mode,
    flashDeck,
    index,
    isFlipped,
    activeCard,
    startFlashcards,
    exitFlashcards,
    completeRevisionSession,
    flip,
    next,
    previous,
  } = useRevision({ variant: 'hub' });

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
        subtitle="Ukończ onboarding, aby korzystać z powtórki."
        primaryLabel="Przejdź do onboardingu"
        onPrimaryPress={() => router.replace('/(onboarding)')}
      />
    );
  }

  if (sessionPhase === 'hub') {
    return (
      <RevisionHub
        knownTotal={hubCounts.all}
        counts={hubCounts}
        onSelectSession={enterSession}
      />
    );
  }

  if (
    sessionConfig &&
    knownWords.length === 0 &&
    mode === 'list'
  ) {
    return (
      <CenteredMessageCta
        variant="revision"
        title="Brak słów w tym trybie"
        subtitle="Wybierz inną sesję w Revision Hub albo dodaj słowa w Daily."
        primaryLabel="Wróć do Revision Hub"
        onPrimaryPress={exitSessionToHub}
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
        exitFlashcards={exitFlashcards}
        flip={flip}
        next={next}
        previous={previous}
        sessionLabel={
          sessionConfig ? getFlashSessionLabel(sessionConfig) : undefined
        }
        onLastCardContinue={
          sessionPhase === 'session'
            ? () => {
                const stats = completeRevisionSession();
                if (stats) {
                  router.push({
                    pathname: '/revision-session-complete',
                    params: {
                      cardsReviewed: String(stats.cardsReviewed),
                      sessionDurationMs: String(stats.sessionDurationMs),
                      mode: stats.mode,
                    },
                  });
                } else {
                  exitFlashcards();
                }
              }
            : undefined
        }
      />
    );
  }

  return (
    <RevisionKnownWordsList
      knownWords={knownWords}
      sortPrefs={sortPrefs}
      onSortPrefsChange={setRevisionSortPrefs}
      onStartFlashcards={startFlashcards}
      onOpenWord={(w) => router.push(`/word/${w.id}?from=revision`)}
      headerTitle={
        sessionConfig ? getSessionScreenTitle(sessionConfig) : 'Revision Hub'
      }
      onBackPress={exitSessionToHub}
      backAccessibilityLabel="Wróć do Revision Hub"
      sessionVariant
    />
  );
}
