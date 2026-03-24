import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

import { PROFILE_SETTINGS_SAVED } from '@/src/events/profileSettingsEvents';
import { getUserProfile } from '@/src/services/storage/profileStorage';
import {
  applyDailyWordAction,
  applyOptimisticDailySnapshot,
  getDailyWordSnapshot,
  type DailyWordSnapshot,
} from '@/src/services/dailyWord/dailyWordService';
import { syncWidgetLoadingSnapshot } from '@/src/services/widgets/widgetLoadingSync';
import { syncWidgetSnapshotFromApp } from '@/src/services/widgets/syncWidgetSnapshot';
import type { UserProfile } from '@/src/types/profile';

/**
 * Stan zapisu known/skip:
 * - `isSyncPending`: trwa kolejka zapisów na serwer; interakcje zablokowane (spójność `activeWordId`).
 * - `isOptimisticTransition`: następne słowo pokazane z lokalnego prefetchu; bez „sztucznych” spinnerów.
 *   Gdy false przy `isSyncPending`, czekamy na snapshot z serwera (brak lokalnego następnego kroku).
 */
type DailyWordState = {
  isLoading: boolean;
  isSyncPending: boolean;
  isOptimisticTransition: boolean;
  profile: UserProfile | null;
  snapshot: DailyWordSnapshot | null;
};

export type UseDailyWordReturn = {
  isLoading: boolean;
  isSyncPending: boolean;
  isOptimisticTransition: boolean;
  /** Overlay + spinner na Known: tylko gdy sync i brak optymistycznego prefetchu. */
  showBlockingLoadingUi: boolean;
  profile: UserProfile | null;
  snapshot: DailyWordSnapshot | null;
  canAct: boolean;
  refresh: () => Promise<void>;
  markKnown: () => Promise<void>;
  skipWord: () => Promise<void>;
};

const initialState: DailyWordState = {
  isLoading: true,
  isSyncPending: false,
  isOptimisticTransition: false,
  profile: null,
  snapshot: null,
};

export function useDailyWord(): UseDailyWordReturn {
  const [state, setState] = useState<DailyWordState>(initialState);

  const snapshotRef = useRef<DailyWordSnapshot | null>(null);
  snapshotRef.current = state.snapshot;

  const profileRef = useRef<UserProfile | null>(null);
  profileRef.current = state.profile;

  const actionQueueRef = useRef<Array<'known' | 'skip'>>([]);
  const processingQueueRef = useRef(false);

  const refresh = useCallback(async () => {
    actionQueueRef.current = [];
    const profile = await getUserProfile();
    if (!profile) {
      setState({
        isLoading: false,
        isSyncPending: false,
        isOptimisticTransition: false,
        profile: null,
        snapshot: null,
      });
      await syncWidgetSnapshotFromApp();
      return;
    }

    const snapshot = await getDailyWordSnapshot(profile);
    setState({
      isLoading: false,
      isSyncPending: false,
      isOptimisticTransition: false,
      profile,
      snapshot,
    });
    await syncWidgetSnapshotFromApp();
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PROFILE_SETTINGS_SAVED, () => {
      void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const processActionQueue = useCallback(async () => {
    if (processingQueueRef.current) {
      return;
    }
    processingQueueRef.current = true;
    try {
      while (actionQueueRef.current.length > 0) {
        const action = actionQueueRef.current.shift()!;
        const profile = await getUserProfile();
        if (!profile) {
          actionQueueRef.current = [];
          setState((prev) => ({
            ...prev,
            isSyncPending: false,
            isOptimisticTransition: false,
          }));
          break;
        }
        try {
          const serverSnapshot = await applyDailyWordAction(profile, action);
          const freshProfile = await getUserProfile();
          setState((prev) => ({
            ...prev,
            profile: freshProfile ?? prev.profile,
            snapshot: serverSnapshot,
          }));
        } catch {
          actionQueueRef.current = [];
          setState((prev) => ({
            ...prev,
            isSyncPending: false,
            isOptimisticTransition: false,
          }));
          await refresh();
          return;
        }
      }
    } finally {
      await syncWidgetSnapshotFromApp();
      processingQueueRef.current = false;
      if (actionQueueRef.current.length > 0) {
        void processActionQueue();
      } else {
        setState((prev) => ({
          ...prev,
          isSyncPending: false,
          isOptimisticTransition: false,
        }));
      }
    }
  }, [refresh]);

  const runAction = useCallback(
    async (action: 'known' | 'skip') => {
      const snap = snapshotRef.current;
      if (!snap?.activeWord) {
        return;
      }

      let profile = profileRef.current;
      if (!profile) {
        profile = await getUserProfile();
      }
      if (!profile) {
        return;
      }

      const optimistic = applyOptimisticDailySnapshot(snap, action);
      if (optimistic) {
        setState((prev) => ({
          ...prev,
          profile,
          snapshot: optimistic,
          isSyncPending: true,
          isOptimisticTransition: true,
        }));
      } else {
        void syncWidgetLoadingSnapshot();
        setState((prev) => ({
          ...prev,
          profile,
          isSyncPending: true,
          isOptimisticTransition: false,
        }));
      }

      actionQueueRef.current.push(action);
      void processActionQueue();
    },
    [processActionQueue],
  );

  const markKnown = useCallback(() => runAction('known'), [runAction]);
  const skipWord = useCallback(() => runAction('skip'), [runAction]);

  const canAct = useMemo(
    () => Boolean(state.snapshot?.activeWord),
    [state.snapshot?.activeWord],
  );

  const showBlockingLoadingUi = useMemo(
    () => state.isSyncPending && !state.isOptimisticTransition,
    [state.isSyncPending, state.isOptimisticTransition],
  );

  return {
    isLoading: state.isLoading,
    isSyncPending: state.isSyncPending,
    isOptimisticTransition: state.isOptimisticTransition,
    showBlockingLoadingUi,
    profile: state.profile,
    snapshot: state.snapshot,
    canAct,
    refresh,
    markKnown,
    skipWord,
  };
}
