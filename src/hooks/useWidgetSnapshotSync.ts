import { useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { syncWidgetSnapshotFromApp } from '@/src/services/widgets/syncWidgetSnapshot';

/**
 * Keeps the home-screen widget snapshot in sync when the app becomes active
 * and after the first successful mount.
 */
export function useWidgetSnapshotSync(enabled: boolean) {
  const run = useCallback(async () => {
    if (!enabled) {
      return;
    }
    await syncWidgetSnapshotFromApp();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void run();
  }, [enabled, run]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        void run();
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [enabled, run]);
}
