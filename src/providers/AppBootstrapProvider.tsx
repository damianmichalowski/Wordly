import { createContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { isOnboardingComplete } from '@/src/services/storage/onboardingStorage';

type AppBootstrapContextValue = {
  isReady: boolean;
  hasOnboarded: boolean;
  markOnboardingComplete: () => void;
};

export const AppBootstrapContext = createContext<AppBootstrapContextValue | null>(null);

export function AppBootstrapProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadBootstrap = async () => {
      const hasCompletedOnboarding = await isOnboardingComplete();
      if (isMounted) {
        setHasOnboarded(hasCompletedOnboarding);
        setIsReady(true);
      }
    };

    loadBootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      isReady,
      hasOnboarded,
      markOnboardingComplete: () => setHasOnboarded(true),
    }),
    [hasOnboarded, isReady],
  );

  return <AppBootstrapContext.Provider value={value}>{children}</AppBootstrapContext.Provider>;
}
