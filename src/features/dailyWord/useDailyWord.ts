import { useCallback, useEffect, useMemo, useState } from 'react';

import { getUserProfile } from '@/src/services/storage/profileStorage';
import { applyDailyWordAction, getDailyWordSnapshot } from '@/src/services/dailyWord/dailyWordService';
import type { DailyWordSnapshot } from '@/src/services/dailyWord/dailyWordService';
import type { UserProfile } from '@/src/types/profile';

type DailyWordState = {
  isLoading: boolean;
  profile: UserProfile | null;
  snapshot: DailyWordSnapshot | null;
};

export function useDailyWord() {
  const [state, setState] = useState<DailyWordState>({
    isLoading: true,
    profile: null,
    snapshot: null,
  });

  const refresh = useCallback(async () => {
    const profile = await getUserProfile();
    if (!profile) {
      setState({
        isLoading: false,
        profile: null,
        snapshot: null,
      });
      return;
    }

    const snapshot = await getDailyWordSnapshot(profile);
    setState({
      isLoading: false,
      profile,
      snapshot,
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applyAction = useCallback(
    async (action: 'known' | 'skip') => {
      if (!state.profile) {
        return;
      }
      const snapshot = await applyDailyWordAction(state.profile, action);
      setState((prev) => ({
        ...prev,
        snapshot,
      }));
    },
    [state.profile],
  );

  const canAct = useMemo(() => Boolean(state.snapshot?.activeWord), [state.snapshot?.activeWord]);

  return {
    ...state,
    canAct,
    refresh,
    markKnown: () => applyAction('known'),
    skipWord: () => applyAction('skip'),
  };
}
