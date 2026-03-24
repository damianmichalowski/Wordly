import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { parseHomeDeepLink } from '@/src/services/widgets/deepLinks';
import { syncWidgetSnapshotFromApp } from '@/src/services/widgets/syncWidgetSnapshot';
import { applyWidgetAction } from '@/src/services/widgets/widgetSurfaceService';

/**
 * Obsługuje `wordly://home?...&action=known` z widgetu iOS (przycisk Known).
 */
export function useWidgetDeepLinkActions(enabled: boolean) {
  const router = useRouter();
  const lastHandledKey = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const run = async (url: string) => {
      const parsed = parseHomeDeepLink(url);
      if (parsed.route !== 'home' || !parsed.action) {
        return;
      }

      const dedupeKey = `${url}`;
      if (lastHandledKey.current === dedupeKey) {
        return;
      }
      lastHandledKey.current = dedupeKey;

      try {
        const result = await applyWidgetAction({
          action: parsed.action,
          expectedStateVersion: parsed.stateVersion,
        });
        await syncWidgetSnapshotFromApp();
        if (result.status === 'ok' || result.status === 'stale') {
          router.replace('/(tabs)/home');
        }
      } catch {
        lastHandledKey.current = null;
      } finally {
        setTimeout(() => {
          if (lastHandledKey.current === dedupeKey) {
            lastHandledKey.current = null;
          }
        }, 1500);
      }
    };

    void Linking.getInitialURL().then((url) => {
      if (url) {
        void run(url);
      }
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      void run(url);
    });

    return () => sub.remove();
  }, [enabled, router]);
}
