import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { consumeAchievementEvents } from '@/src/features/achievements/services/achievements.service';
import { queueRevisionAutoSession } from '@/src/features/revision/revisionPendingAutoSession';
import { logUserAction } from '@/src/utils/userActionLog';
import { RevisionSessionCompleteScreen } from '@/src/features/revision/screens/RevisionSessionCompleteScreen';
import type { RevisionSessionCompletionStats } from '@/src/types/revisionSession';

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseOptionalNonNegativeInt(
  raw: string | undefined,
): number | undefined {
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function parseFlag(raw: string | undefined): boolean {
  return raw === '1' || raw === 'true';
}

export default function RevisionSessionCompleteRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    cardsReviewed?: string;
    sessionDurationMs?: string;
    mode?: string;
    endedEarly?: string;
    knowCount?: string;
    dontKnowCount?: string;
    achievementEventIds?: string;
    dailyReviewStreak?: string;
    streakTrophyTitle?: string;
    difficultReviewed?: string;
    difficultMastered?: string;
    difficultStill?: string;
  }>();

  const achievementEventIds = useMemo(() => {
    const raw =
      typeof params.achievementEventIds === 'string'
        ? params.achievementEventIds
        : '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [params.achievementEventIds]);

  const difficultReviewed = parseOptionalNonNegativeInt(params.difficultReviewed);
  const difficultMastered = parseOptionalNonNegativeInt(params.difficultMastered);
  const difficultStill = parseOptionalNonNegativeInt(params.difficultStill);
  const knowCount = parseOptionalNonNegativeInt(params.knowCount);
  const dontKnowCount = parseOptionalNonNegativeInt(params.dontKnowCount);

  const sessionStats: RevisionSessionCompletionStats = {
    cardsReviewed: parsePositiveInt(params.cardsReviewed, 0),
    sessionDurationMs: parsePositiveInt(params.sessionDurationMs, 0),
    mode: typeof params.mode === 'string' && params.mode.length > 0 ? params.mode : 'unknown',
    endedEarly: parseFlag(params.endedEarly),
    ...(knowCount !== undefined && dontKnowCount !== undefined
      ? {
          answerStats: {
            reviewed: parsePositiveInt(params.cardsReviewed, 0),
            knowCount,
            dontKnowCount,
          },
        }
      : {}),
    ...(difficultReviewed !== undefined &&
    difficultMastered !== undefined &&
    difficultStill !== undefined
      ? {
          difficultWordsCompletion: {
            reviewed: difficultReviewed,
            mastered: difficultMastered,
            stillDifficult: difficultStill,
          },
        }
      : {}),
  };

  const dailyReviewStreak = parseOptionalNonNegativeInt(params.dailyReviewStreak);
  const streakTrophyTitle =
    typeof params.streakTrophyTitle === 'string' && params.streakTrophyTitle.length > 0
      ? params.streakTrophyTitle
      : undefined;

  const isDifficultMode = sessionStats.mode.startsWith('difficultWords');
  const hasDifficultRemaining =
    sessionStats.difficultWordsCompletion?.stillDifficult !== undefined &&
    sessionStats.difficultWordsCompletion.stillDifficult > 0;

  return (
    <RevisionSessionCompleteScreen
      sessionStats={sessionStats}
      dailyReviewStreak={dailyReviewStreak}
      streakTrophyTitle={streakTrophyTitle}
      onRepeatDifficultSession={
        isDifficultMode && hasDifficultRemaining
          ? () => {
              logUserAction('button_press', {
                target: 'revision_session_complete_repeat_difficult',
                mode: sessionStats.mode,
              });
              void consumeAchievementEvents(achievementEventIds)
                .catch(() => {
                  /* best-effort */
                })
                .finally(() => {
                  queueRevisionAutoSession('difficultWords');
                  router.dismissTo('/(tabs)/revision');
                });
            }
          : undefined
      }
      onBackToRevisionHub={() => {
        logUserAction('button_press', {
          target: 'revision_session_complete_back_hub',
          mode: sessionStats.mode,
        });
        void consumeAchievementEvents(achievementEventIds)
          .catch(() => {
            /* best-effort */
          })
          .finally(() => {
            router.dismissTo('/(tabs)/revision');
          });
      }}
      onBackToHome={() => {
        logUserAction('button_press', {
          target: 'revision_session_complete_back_home',
          mode: sessionStats.mode,
        });
        void consumeAchievementEvents(achievementEventIds)
          .catch(() => {
            /* best-effort */
          })
          .finally(() => {
            router.dismissTo('/(tabs)/home');
          });
      }}
    />
  );
}
