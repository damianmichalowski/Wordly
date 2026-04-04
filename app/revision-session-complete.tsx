import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { consumeAchievementEvents } from '@/src/features/achievements/services/achievements.service';
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

export default function RevisionSessionCompleteRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    cardsReviewed?: string;
    sessionDurationMs?: string;
    mode?: string;
    achievementEventIds?: string;
    dailyReviewStreak?: string;
    streakTrophyTitle?: string;
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

  const sessionStats: RevisionSessionCompletionStats = {
    cardsReviewed: parsePositiveInt(params.cardsReviewed, 0),
    sessionDurationMs: parsePositiveInt(params.sessionDurationMs, 0),
    mode: typeof params.mode === 'string' && params.mode.length > 0 ? params.mode : 'unknown',
  };

  const dailyReviewStreak = parseOptionalNonNegativeInt(params.dailyReviewStreak);
  const streakTrophyTitle =
    typeof params.streakTrophyTitle === 'string' && params.streakTrophyTitle.length > 0
      ? params.streakTrophyTitle
      : undefined;

  return (
    <RevisionSessionCompleteScreen
      sessionStats={sessionStats}
      dailyReviewStreak={dailyReviewStreak}
      streakTrophyTitle={streakTrophyTitle}
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
