import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { CenteredMessageCta } from '@/src/components/ui/CenteredMessageCta';
import { RevisionFlashcardMode } from '@/src/features/revision/components/RevisionFlashcardMode';
import { RevisionHub } from '@/src/features/revision/components/RevisionHub';
import {
  getFlashSessionLabel,
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
    sessionPhase,
    sessionConfig,
    sessionFetchPending,
    enterSession,
    exitSessionToHub,
    cancelHubRevisionSession,
    hubCounts,
    dailyRevisionCompletedToday,
    mode,
    flashDeck,
    index,
    isFlipped,
    activeCard,
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
        dailyReviewCompletedToday={dailyRevisionCompletedToday}
        onSelectSession={enterSession}
      />
    );
  }

  if (sessionPhase === 'session' && sessionFetchPending) {
    return (
      <View
        style={[
          revisionScreenStyles.centered,
          { paddingTop: 24, paddingBottom: 24 },
        ]}
      >
        <ActivityIndicator size="small" color={StitchColors.primary} />
        <Text style={revisionScreenStyles.subtitle}>Ładowanie sesji…</Text>
      </View>
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
        onAbortSession={cancelHubRevisionSession}
        flip={flip}
        next={next}
        previous={previous}
        sessionLabel={
          sessionConfig ? getFlashSessionLabel(sessionConfig) : undefined
        }
        onLastCardContinue={
          sessionPhase === 'session'
            ? () => {
                void (async () => {
                  const stats = await completeRevisionSession();
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
                    cancelHubRevisionSession();
                  }
                })();
              }
            : undefined
        }
      />
    );
  }

  return null;
}
