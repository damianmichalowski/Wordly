import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react'

import type {
  LearningLevel,
  LearningModeType,
} from '@/src/features/profile/types/profile.types'

export type OnboardingDraft = {
  nativeLanguageId: string | null
  learningLanguageId: string | null
  learningModeType: LearningModeType
  learningLevel: LearningLevel | null
  selectedCategoryId: string | null
};

type OnboardingContextValue = {
  draft: OnboardingDraft;
  setNativeLanguageId: (id: string) => void
  setLearningLanguageId: (id: string) => void
  setLearningModeType: (value: LearningModeType) => void
  setLearningLevel: (value: LearningLevel | null) => void
  setSelectedCategoryId: (id: string | null) => void
  reset: () => void;
};

const initialDraft: OnboardingDraft = {
  nativeLanguageId: null,
  learningLanguageId: null,
  learningModeType: 'difficulty',
  learningLevel: null,
  selectedCategoryId: null,
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      draft,
      setNativeLanguageId: (id) =>
        setDraft((prev) => ({ ...prev, nativeLanguageId: id })),
      setLearningLanguageId: (id) =>
        setDraft((prev) => ({ ...prev, learningLanguageId: id })),
      setLearningModeType: (value) =>
        setDraft((prev) => ({
          ...prev,
          learningModeType: value,
        })),
      setLearningLevel: (value) =>
        setDraft((prev) => ({
          ...prev,
          learningLevel: value,
          ...(value != null ? { selectedCategoryId: null } : {}),
        })),
      setSelectedCategoryId: (id) =>
        setDraft((prev) => ({
          ...prev,
          selectedCategoryId: id,
          ...(id != null ? { learningLevel: null } : {}),
        })),
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
