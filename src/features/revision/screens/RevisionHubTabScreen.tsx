import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CenteredMessageCta } from '@/src/components/ui/CenteredMessageCta';
import { TransportRetryMessage } from '@/src/components/ui/TransportRetryMessage';
import { RevisionFlashcardMode } from '@/src/features/revision/components/RevisionFlashcardMode';
import { RevisionHub } from '@/src/features/revision/components/RevisionHub';
import { RevisionHubTabDeferredShell } from '@/src/features/revision/components/RevisionHubTabDeferredShell';
import { useRevisionHubScreenData } from '@/src/features/revision/hooks/useRevisionHubScreenData';
import { getFlashSessionLabel } from '@/src/features/revision/revisionSessionUi';
import { StitchColors } from '@/src/theme/wordlyStitchTheme';
import { logUserAction } from '@/src/utils/userActionLog';

/**
 * Zakładka Revision Hub: tryby powtórki (bento). Branching z `viewKind` (hook) — jedna kolejność decyzji.
 */
export default function RevisionHubTabScreen() {
  const router = useRouter();
  const data = useRevisionHubScreenData();
  const {
    viewKind,
    settingsRetryBusy,
    hubStatsRetryBusy,
    hubStatsReady,
    hubUnlockEmptyConfirmed,
    knownWords,
    sessionPhase,
    sessionConfig,
    sessionFetchPending,
    enterSession,
    exitSessionToHub,
    cancelHubRevisionSession,
    hubCounts,
    dailyRevisionCompletedToday,
    currentDailyReviewStreak,
    mode,
    flashDeck,
    index,
    isFlipped,
    activeCard,
    completeRevisionSession,
    flip,
    next,
    previous,
    hubLoadError,
    refresh,
  } = data;

  const hubProps = {
    knownTotal: hubCounts.all,
    hubStatsReady,
    unlockEmptyCtaConfirmed: hubUnlockEmptyConfirmed,
    counts: hubCounts,
    dailyReviewCompletedToday: dailyRevisionCompletedToday,
    dailyReviewStreak: currentDailyReviewStreak,
    onSelectSession: enterSession,
    hubStatsLoadError: hubLoadError,
    hubStatsRetryBusy,
    onRetryHubStats: () => {
      void refresh();
    },
  } as const;

  switch (viewKind) {
    case 'settings_transport_error':
      return (
        <SafeAreaView
          style={{ flex: 1, backgroundColor: StitchColors.surface }}
          edges={['top', 'bottom']}
        >
          <TransportRetryMessage
            variant="screen"
            isRetrying={settingsRetryBusy}
            onRetry={() => {
              logUserAction('button_press', {
                target: 'revision_hub_settings_fetch_retry',
              });
              void refresh();
            }}
          />
        </SafeAreaView>
      );

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
                      const dr = stats.dailyReviewCompletion;
                      const pending = dr?.pendingEvents ?? [];
                      const streakTrophyEv =
                        dr?.pendingEvents?.find(
                          (e) => e.source === 'streak_daily_review',
                        ) ?? null;
                      router.push({
                        pathname: '/revision-session-complete',
                        params: {
                          cardsReviewed: String(stats.cardsReviewed),
                          sessionDurationMs: String(stats.sessionDurationMs),
                          mode: stats.mode,
                          ...(stats.mode === 'daily' && dr
                            ? {
                                dailyReviewStreak: String(
                                  dr.currentDailyReviewStreak,
                                ),
                                ...(streakTrophyEv
                                  ? { streakTrophyTitle: streakTrophyEv.title }
                                  : {}),
                              }
                            : {}),
                          ...(pending.length > 0
                            ? {
                                achievementEventIds: pending
                                  .map((e) => e.eventId)
                                  .join(','),
                              }
                            : {}),
                        },
                      });
                    }
                  })();
                }
              : undefined
          }
        />
      );

    case 'revision_hub_surface':
      return <RevisionHub {...hubProps} />;
  }
}
