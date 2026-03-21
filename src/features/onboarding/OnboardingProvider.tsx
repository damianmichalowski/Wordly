import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import type { CefrLevel } from '@/src/types/cefr';
import type { LanguageCode } from '@/src/types/language';
import type { DisplayLevelPolicy } from '@/src/types/profile';

export type OnboardingDraft = {
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  currentLevel: CefrLevel;
  displayLevelPolicy: DisplayLevelPolicy;
};

type OnboardingContextValue = {
  draft: OnboardingDraft;
  setSourceLanguage: (value: LanguageCode) => void;
  setTargetLanguage: (value: LanguageCode) => void;
  setCurrentLevel: (value: CefrLevel) => void;
  reset: () => void;
};

const initialDraft: OnboardingDraft = {
  sourceLanguage: 'pl',
  targetLanguage: 'en',
  currentLevel: 'A1',
  displayLevelPolicy: 'next-level',
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      draft,
      setSourceLanguage: (value) => setDraft((prev) => ({ ...prev, sourceLanguage: value })),
      setTargetLanguage: (value) => setDraft((prev) => ({ ...prev, targetLanguage: value })),
      setCurrentLevel: (value) => setDraft((prev) => ({ ...prev, currentLevel: value })),
      reset: () => setDraft(initialDraft),
    }),
    [draft],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingDraft() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboardingDraft must be used within OnboardingProvider.');
  }

  return context;
}
