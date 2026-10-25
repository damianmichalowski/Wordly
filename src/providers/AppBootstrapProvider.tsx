import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";

import { getDeviceLanguageCode } from "@/src/i18n/expoLocalizationSafe";
import { applyAppLocale, i18nInitPromise } from "@/src/i18n/i18n";
import { normalizeToAppLocale } from "@/src/i18n/resolveLocale";
import {
  getCachedAppLocale,
  setCachedAppLocale,
} from "@/src/i18n/uiLocaleStorage";
import { useWidgetDeepLinkActions } from "@/src/hooks/useWidgetDeepLinkActions";
import { useWidgetSnapshotSync } from "@/src/hooks/useWidgetSnapshotSync";
import { getUserProfileSettings } from "@/src/features/profile/services/profile.service";
import { getSupabaseClient, hasSupabaseEnv } from "@/src/lib/supabase/client";
import { isOnboardingComplete } from "@/src/services/storage/onboardingStorage";

type AppBootstrapContextValue = {
  isReady: boolean;
  hasOnboarded: boolean;
  /** Przy skonfigurowanym Supabase: true tylko gdy jest aktywna sesja auth. */
  isAuthenticated: boolean;
  markOnboardingComplete: () => void;
  /** Dev / testy po {@link clearOnboardingCompletionFlag}: zsynchronizuj stan z pamięcią. */
  markOnboardingIncomplete: () => void;
};

export const AppBootstrapContext =
  createContext<AppBootstrapContextValue | null>(null);

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
      await i18nInitPromise;
      if (cancelled) {
        return;
      }

      const supabaseConfigured = hasSupabaseEnv();
      const hasCompletedOnboarding = await isOnboardingComplete();

      let session: Session | null = null;
      if (supabaseConfigured) {
        const { data } = await getSupabaseClient().auth.getSession();
        session = data.session ?? null;
        if (!cancelled) {
          setIsAuthenticated(Boolean(session));
        }
      } else if (!cancelled) {
        setIsAuthenticated(true);
      }

      if (cancelled) {
        return;
      }

      if (supabaseConfigured && session) {
        try {
          const settings = await getUserProfileSettings();
          if (cancelled) {
            return;
          }
          if (settings) {
            const locale = normalizeToAppLocale(settings.native_language.code);
            await applyAppLocale(locale);
            await setCachedAppLocale(locale);
          } else {
            const cached = await getCachedAppLocale();
            const fallback =
              cached ?? normalizeToAppLocale(getDeviceLanguageCode());
            await applyAppLocale(fallback);
          }
        } catch {
          const cached = await getCachedAppLocale();
          const fallback =
            cached ?? normalizeToAppLocale(getDeviceLanguageCode());
          await applyAppLocale(fallback);
        }
      } else {
        const cached = await getCachedAppLocale();
        if (cached) {
          await applyAppLocale(cached);
        }
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

  return (
    <AppBootstrapContext.Provider value={value}>
      {children}
    </AppBootstrapContext.Provider>
  );
}
