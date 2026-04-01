import { useCallback, useMemo, useState } from 'react'

import { emitProfileSettingsSaved } from '@/src/events/profileSettingsEvents'
import {
  getOnboardingOptions,
  getUserProfileSettings,
  invalidateTodayDailyWord,
  upsertUserProfileSettings,
} from '@/src/features/profile/services/profile.service'
import type { LearningOptionsProgress } from "@/src/features/profile/services/learningProgress.service";
import { getLearningOptionsProgress } from "@/src/features/profile/services/learningProgress.service";
import type {
  LearningLevel,
  LearningModeType,
  OnboardingCategory,
  OnboardingLanguage,
  OnboardingOptions,
  UserProfileSettings,
} from '@/src/features/profile/types/profile.types'

type SettingsState = {
  isLoading: boolean;
  isSaving: boolean;
  options: OnboardingOptions | null;
  optionsProgress: LearningOptionsProgress | null;
  settings: UserProfileSettings | null;
  nativeLanguageId: string | null;
  learningLanguageId: string | null;
  learningModeType: LearningModeType;
  learningLevel: LearningLevel | null;
  selectedCategoryId: string | null;
  error?: string;
};

const defaultState: SettingsState = {
  isLoading: true,
  isSaving: false,
  options: null,
  optionsProgress: null,
  settings: null,
  nativeLanguageId: null,
  learningLanguageId: null,
  learningModeType: 'difficulty',
  learningLevel: null,
  selectedCategoryId: null,
};

export function useSettings() {
  const [state, setState] = useState<SettingsState>(defaultState);

  const refresh = useCallback(async () => {
    const [options, settings, optionsProgress] = await Promise.all([
      getOnboardingOptions(),
      getUserProfileSettings(),
      getLearningOptionsProgress().catch(() => null),
    ]);

    setState((prev) => ({
      ...prev,
      isLoading: false,
      isSaving: false,
      options,
      optionsProgress,
      settings,
      nativeLanguageId: settings?.native_language?.id ?? options.languages[0]?.id ?? null,
      learningLanguageId: settings?.learning_language?.id ?? options.languages[0]?.id ?? null,
      learningModeType: settings?.learning_mode_type ?? 'difficulty',
      learningLevel: (settings?.learning_level ?? null) as LearningLevel | null,
      selectedCategoryId: settings?.selected_category?.id ?? null,
      error: undefined,
    }))
  }, []);

  const canSave = useMemo(() => {
    if (state.isSaving || state.isLoading) {
      return false
    }
    if (!state.nativeLanguageId || !state.learningLanguageId) {
      return false
    }
    if (state.nativeLanguageId === state.learningLanguageId) {
      return false
    }
    if (state.learningModeType === 'difficulty') {
      return state.learningLevel != null
    }
    return state.selectedCategoryId != null
  }, [
    state.isLoading,
    state.isSaving,
    state.learningLanguageId,
    state.learningLevel,
    state.learningModeType,
    state.nativeLanguageId,
    state.selectedCategoryId,
  ])

  const save = useCallback(async () => {
    if (!state.options) {
      return
    }
    if (!state.nativeLanguageId || !state.learningLanguageId) {
      setState((prev) => ({ ...prev, error: 'Please select both languages.' }))
      return
    }
    if (state.nativeLanguageId === state.learningLanguageId) {
      setState((prev) => ({
        ...prev,
        error: 'Native and learning language must be different.',
      }))
      return
    }
    if (state.learningModeType === 'difficulty' && !state.learningLevel) {
      setState((prev) => ({ ...prev, error: 'Please select a difficulty level.' }))
      return
    }
    if (state.learningModeType === 'category' && !state.selectedCategoryId) {
      setState((prev) => ({ ...prev, error: 'Please select a category.' }))
      return
    }

    setState((prev) => ({ ...prev, isSaving: true, error: undefined }))

    try {
      const saved = await upsertUserProfileSettings({
        p_native_language_id: state.nativeLanguageId,
        p_learning_language_id: state.learningLanguageId,
        p_learning_mode_type: state.learningModeType,
        p_learning_level: state.learningModeType === 'difficulty' ? state.learningLevel ?? undefined : undefined,
        p_selected_category_id:
          state.learningModeType === 'category' ? state.selectedCategoryId ?? undefined : undefined,
      })

      await invalidateTodayDailyWord()

      setState((prev) => ({
        ...prev,
        isSaving: false,
        settings: saved,
        nativeLanguageId: saved.native_language.id,
        learningLanguageId: saved.learning_language.id,
        learningModeType: saved.learning_mode_type,
        learningLevel: (saved.learning_level ?? null) as LearningLevel | null,
        selectedCategoryId: saved.selected_category?.id ?? null,
      }))

      emitProfileSettingsSaved()
    } catch (e) {
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: e instanceof Error ? e.message : 'Failed to save settings.',
      }))
    }
  }, [
    state.learningLanguageId,
    state.learningLevel,
    state.learningModeType,
    state.nativeLanguageId,
    state.options,
    state.selectedCategoryId,
  ])

  const nativeLanguage = useMemo<OnboardingLanguage | null>(() => {
    if (!state.options || !state.nativeLanguageId) {
      return null
    }
    return state.options.languages.find((l) => l.id === state.nativeLanguageId) ?? null
  }, [state.nativeLanguageId, state.options])

  const learningLanguage = useMemo<OnboardingLanguage | null>(() => {
    if (!state.options || !state.learningLanguageId) {
      return null
    }
    return state.options.languages.find((l) => l.id === state.learningLanguageId) ?? null
  }, [state.learningLanguageId, state.options])

  const selectedCategory = useMemo<OnboardingCategory | null>(() => {
    if (!state.options || !state.selectedCategoryId) {
      return null
    }
    return state.options.categories.find((c) => c.id === state.selectedCategoryId) ?? null
  }, [state.options, state.selectedCategoryId])

  return {
    ...state,
    canSave,
    nativeLanguage,
    learningLanguage,
    selectedCategory,
    setNativeLanguageId: (id: string) => setState((prev) => ({ ...prev, nativeLanguageId: id })),
    setLearningLanguageId: (id: string) => setState((prev) => ({ ...prev, learningLanguageId: id })),
    /** Zakładka tylko przełącza widok. Wybór kafelka ustawia jeden tor: poziom XOR kategoria. */
    setLearningModeType: (value: LearningModeType) =>
      setState((prev) => ({
        ...prev,
        learningModeType: value,
      })),
    setLearningLevel: (value: LearningLevel | null) =>
      setState((prev) => ({
        ...prev,
        learningLevel: value,
        ...(value != null ? { selectedCategoryId: null } : {}),
      })),
    setSelectedCategoryId: (id: string | null) =>
      setState((prev) => ({
        ...prev,
        selectedCategoryId: id,
        ...(id != null ? { learningLevel: null } : {}),
      })),
    save,
    refresh,
    optionsProgress: state.optionsProgress,
  };
}
