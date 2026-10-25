import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { defaultRevisionSessionSize } from '@/src/features/revision/revisionSessionSize';
import {
  consumePendingRevisionAutoSession,
} from '@/src/features/revision/revisionPendingAutoSession';
import { getRevisionHubStats } from '@/src/features/revision/services/revisionRpc.service';
import { queryKeys } from '@/src/lib/query/queryKeys';

import { CenteredMessageCta } from '@/src/components/ui/CenteredMessageCta';
import { EndSessionConfirmSheet } from '@/src/features/revision/components/EndSessionConfirmSheet';
import { RevisionFlashcardMode } from '@/src/features/revision/components/RevisionFlashcardMode';
import { RevisionHub } from '@/src/features/revision/components/RevisionHub';
import { RevisionHubTabDeferredShell } from '@/src/features/revision/components/RevisionHubTabDeferredShell';
import { useRevisionHubScreenData } from '@/src/features/revision/hooks/useRevisionHubScreenData';
import { buildRevisionSessionCompleteParams } from '@/src/features/revision/revisionSessionCompletionNav';
import { getFlashSessionLabel } from '@/src/features/revision/revisionSessionUi';
import type { RevisionSessionCompletionStats } from '@/src/types/revisionSession';
import { StitchColors } from '@/src/theme/wordlyStitchTheme';
import { logUserAction } from '@/src/utils/userActionLog';

/**
 * Zakładka Revision Hub: tryby powtórki (bento). Branching z `viewKind` (hook) — jedna kolejność decyzji.
 */
export default function RevisionHubTabScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const data = useRevisionHubScreenData();
  const [endSessionSheetVisible, setEndSessionSheetVisible] = useState(false);
  const {
    viewKind,
    hubStatsReady,
    hubUnlockEmptyConfirmed,
    sessionPhase,
    sessionConfig,
    sessionStartedOffline,
    sessionFetchPending,
    enterSession,
    exitSessionToHub,
    hubCounts,
    dailyRevisionCompletedToday,
    currentDailyReviewStreak,
    flashDeck,
    index,
    isFlipped,
    lastFlipDirection,
    activeCard,
    completeRevisionSession,
    difficultWordsCount,
    difficultSessionAnswerError,
    submitFlashcardKnow,
    submitFlashcardDontKnow,
    undoFlashcardAnswer,
    canUndoFlashcard,
    getDifficultDisplayStreak,
    flip,
  } = data;

  const isDifficultSession = sessionConfig?.kind === "difficultWords";

  const navigateToSessionComplete = useCallback(
    (stats: RevisionSessionCompletionStats) => {
      router.push({
        pathname: '/revision-session-complete',
        params: buildRevisionSessionCompleteParams(stats),
      });
    },
    [router],
  );

  const finalizeSession = useCallback(
    async (endedEarly: boolean) => {
      const stats = await completeRevisionSession({ endedEarly });
      if (stats) {
        navigateToSessionComplete(stats);
      }
    },
    [completeRevisionSession, navigateToSessionComplete],
  );

  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingRevisionAutoSession();
      if (pending !== 'difficultWords') {
        return;
      }

      void (async () => {
        const hub = await queryClient.fetchQuery({
          queryKey: queryKeys.revision.hubStats,
          queryFn: getRevisionHubStats,
        });
        const count = hub?.difficultWords?.availableCount ?? 0;
        if (count <= 0) {
          return;
        }
        const limit = defaultRevisionSessionSize(count);
        enterSession({ kind: 'difficultWords', limit });
      })();
    }, [enterSession, queryClient]),
  );

  const hubProps = {
    knownTotal: hubCounts.all,
    hubStatsReady,
    unlockEmptyCtaConfirmed: hubUnlockEmptyConfirmed,
    counts: hubCounts,
    dailyReviewCompletedToday: dailyRevisionCompletedToday,
    dailyReviewStreak: currentDailyReviewStreak,
    difficultWordsCount,
    onSelectSession: enterSession,
  } as const;

  switch (viewKind) {
    case 'settings_pending_shell':
      return <RevisionHubTabDeferredShell />;

    case 'onboarding_required':
      return (
        <SafeAreaView
          style={{ flex: 1, backgroundColor: StitchColors.surface }}
          edges={['top', 'bottom']}
        >
          <CenteredMessageCta
            variant="revision"
            title="Wymagany onboarding"
            subtitle="Ukończ onboarding, aby korzystać z powtórki."
            primaryLabel="Przejdź do onboardingu"
            onPrimaryPress={() => {
              logUserAction('button_press', {
                target: 'revision_hub_onboarding_required',
              });
              router.replace('/(onboarding)');
            }}
          />
        </SafeAreaView>
      );

    case 'empty_session_list':
      return (
        <CenteredMessageCta
          variant="revision"
          title="Brak słów w tym trybie"
          subtitle="Wybierz inną sesję w Revision Hub albo dodaj słowa w Daily."
          primaryLabel="Wróć do Revision Hub"
          onPrimaryPress={exitSessionToHub}
        />
      );

    case 'flashcard_session':
      return (
        <>
          <RevisionFlashcardMode
            flashDeck={flashDeck}
            index={index}
            activeCard={activeCard}
            isFlipped={isFlipped}
            sessionLoading={sessionFetchPending}
            onRetrySessionLoad={
              sessionConfig
                ? () => {
                    void enterSession(sessionConfig);
                  }
                : undefined
            }
            onEndSession={() => setEndSessionSheetVisible(true)}
            flip={flip}
            lastFlipDirection={lastFlipDirection}
            submitFlashcardKnow={submitFlashcardKnow}
            submitFlashcardDontKnow={submitFlashcardDontKnow}
            undoFlashcardAnswer={undoFlashcardAnswer}
            canUndoFlashcard={canUndoFlashcard}
            sessionLabel={
              sessionConfig ? getFlashSessionLabel(sessionConfig, t) : undefined
            }
            flashcardVariant={isDifficultSession ? 'difficultWords' : 'default'}
            difficultDisplayStreak={
              activeCard ? getDifficultDisplayStreak(activeCard) : 0
            }
            difficultSessionAnswerError={difficultSessionAnswerError}
            offlineDailyNoStreak={
              sessionConfig?.kind === 'daily' && sessionStartedOffline
            }
            onLastCardContinue={
              sessionPhase === 'session'
                ? () => {
                    void finalizeSession(false);
                  }
                : undefined
            }
          />
          <EndSessionConfirmSheet
            visible={endSessionSheetVisible}
            onContinue={() => setEndSessionSheetVisible(false)}
            onConfirmEnd={() => {
              setEndSessionSheetVisible(false);
              void finalizeSession(true);
            }}
          />
        </>
      );

    case 'revision_hub_surface':
      return <RevisionHub {...hubProps} />;
  }
}
