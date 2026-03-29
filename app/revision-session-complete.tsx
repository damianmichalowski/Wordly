import { useLocalSearchParams, useRouter } from 'expo-router';

import { RevisionSessionCompleteScreen } from '@/src/features/revision/screens/RevisionSessionCompleteScreen';
import type { RevisionSessionCompletionStats } from '@/src/types/revisionSession';

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export default function RevisionSessionCompleteRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    cardsReviewed?: string;
    sessionDurationMs?: string;
    mode?: string;
  }>();

  const sessionStats: RevisionSessionCompletionStats = {
    cardsReviewed: parsePositiveInt(params.cardsReviewed, 0),
    sessionDurationMs: parsePositiveInt(params.sessionDurationMs, 0),
    mode: typeof params.mode === 'string' && params.mode.length > 0 ? params.mode : 'unknown',
  };

  return (
    <RevisionSessionCompleteScreen
      sessionStats={sessionStats}
      onBackToRevisionHub={() => {
        router.dismissTo('/(tabs)/revision');
      }}
      onBackToHome={() => {
        router.dismissTo('/(tabs)/home');
      }}
    />
  );
}
