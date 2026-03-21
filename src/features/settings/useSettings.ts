import { useCallback, useEffect, useMemo, useState } from 'react';

import { deriveDisplayLevel } from '@/src/domain/userProfile/levelMapping';
import { upsertProfileToSupabase } from '@/src/services/api/profileApi';
import { resetDailyWordState } from '@/src/services/storage/dailyWordStorage';
import { getUserProfile, saveUserProfile } from '@/src/services/storage/profileStorage';
import type { CefrLevel } from '@/src/types/cefr';
import type { LanguageCode } from '@/src/types/language';
import type { DisplayLevelPolicy, UserProfile } from '@/src/types/profile';

type SettingsState = {
  isLoading: boolean;
  isSaving: boolean;
  profile: UserProfile | null;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  currentLevel: CefrLevel;
  displayLevelPolicy: DisplayLevelPolicy;
  error?: string;
};

const defaultState: SettingsState = {
  isLoading: true,
  isSaving: false,
  profile: null,
  sourceLanguage: 'pl',
  targetLanguage: 'en',
  currentLevel: 'A1',
  displayLevelPolicy: 'next-level',
};

export function useSettings() {
  const [state, setState] = useState<SettingsState>(defaultState);

  const refresh = useCallback(async () => {
    const profile = await getUserProfile();
    if (!profile) {
      setState({
        ...defaultState,
        isLoading: false,
      });
      return;
    }

    setState({
      isLoading: false,
      isSaving: false,
      profile,
      sourceLanguage: profile.languagePair.sourceLanguage,
      targetLanguage: profile.languagePair.targetLanguage,
      currentLevel: profile.currentLevel,
      displayLevelPolicy: profile.displayLevelPolicy,
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const displayLevel = useMemo(
    () => deriveDisplayLevel(state.currentLevel, state.displayLevelPolicy),
    [state.currentLevel, state.displayLevelPolicy],
  );

  const canSave = useMemo(
    () => Boolean(state.profile) && state.sourceLanguage !== state.targetLanguage,
    [state.profile, state.sourceLanguage, state.targetLanguage],
  );

  const save = useCallback(async () => {
    if (!state.profile) {
      return;
    }
    if (state.sourceLanguage === state.targetLanguage) {
      setState((prev) => ({ ...prev, error: 'Source and target language must be different.' }));
      return;
    }

    setState((prev) => ({ ...prev, isSaving: true, error: undefined }));
    const updatedProfile: UserProfile = {
      ...state.profile,
      languagePair: {
        sourceLanguage: state.sourceLanguage,
        targetLanguage: state.targetLanguage,
      },
      currentLevel: state.currentLevel,
      displayLevelPolicy: state.displayLevelPolicy,
      displayLevel,
      updatedAt: new Date().toISOString(),
    };

    await saveUserProfile(updatedProfile);
    await upsertProfileToSupabase(updatedProfile);
    await resetDailyWordState();

    setState((prev) => ({
      ...prev,
      isSaving: false,
      profile: updatedProfile,
    }));
  }, [
    displayLevel,
    state.currentLevel,
    state.displayLevelPolicy,
    state.profile,
    state.sourceLanguage,
    state.targetLanguage,
  ]);

  return {
    ...state,
    displayLevel,
    canSave,
    setSourceLanguage: (value: LanguageCode) => setState((prev) => ({ ...prev, sourceLanguage: value })),
    setTargetLanguage: (value: LanguageCode) => setState((prev) => ({ ...prev, targetLanguage: value })),
    setCurrentLevel: (value: CefrLevel) => setState((prev) => ({ ...prev, currentLevel: value })),
    setDisplayLevelPolicy: (value: DisplayLevelPolicy) =>
      setState((prev) => ({ ...prev, displayLevelPolicy: value })),
    save,
  };
}
