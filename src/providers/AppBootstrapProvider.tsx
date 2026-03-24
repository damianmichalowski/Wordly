import { createContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import * as WebBrowser from 'expo-web-browser';

import { useWidgetDeepLinkActions } from '@/src/hooks/useWidgetDeepLinkActions';
import { useWidgetSnapshotSync } from '@/src/hooks/useWidgetSnapshotSync';
import { getSupabaseClient, hasSupabaseEnv } from '@/src/lib/supabase/client';
import { syncStoredProfileUserIdWithAuth } from '@/src/services/api/profileApi';
import { isOnboardingComplete } from '@/src/services/storage/onboardingStorage';

type AppBootstrapContextValue = {
  isReady: boolean;
  hasOnboarded: boolean;
  /** Przy skonfigurowanym Supabase: true tylko gdy jest aktywna sesja auth. */
  isAuthenticated: boolean;
  markOnboardingComplete: () => void;
  /** Dev / testy po {@link clearOnboardingCompletionFlag}: zsynchronizuj stan z pamięcią. */
  markOnboardingIncomplete: () => void;
};

export const AppBootstrapContext = createContext<AppBootstrapContextValue | null>(null);

export function AppBootstrapProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBootstrap = async () => {
      const supabaseConfigured = hasSupabaseEnv();
      const hasCompletedOnboarding = await isOnboardingComplete();
      if (hasCompletedOnboarding && supabaseConfigured) {
        await syncStoredProfileUserIdWithAuth();
      }

      if (supabaseConfigured) {
        const { data } = await getSupabaseClient().auth.getSession();
        if (!cancelled) {
          setIsAuthenticated(Boolean(data.session));
        }
      } else if (!cancelled) {
        setIsAuthenticated(true);
      }

      if (cancelled) {
        return;
      }
      setHasOnboarded(hasCompletedOnboarding);
      setIsReady(true);
    };

    void loadBootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      return;
    }
    const supabase = getSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      isReady,
      hasOnboarded,
      isAuthenticated,
      markOnboardingComplete: () => setHasOnboarded(true),
      markOnboardingIncomplete: () => setHasOnboarded(false),
    }),
    [hasOnboarded, isAuthenticated, isReady],
  );

  useWidgetSnapshotSync(isReady && hasOnboarded && isAuthenticated);
  useWidgetDeepLinkActions(isReady && hasOnboarded && isAuthenticated);

  return <AppBootstrapContext.Provider value={value}>{children}</AppBootstrapContext.Provider>;
}
