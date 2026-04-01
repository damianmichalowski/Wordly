import { Alert } from 'react-native'

import type { OnboardingDraft } from '@/src/features/onboarding/OnboardingProvider'
import { emitProfileSettingsSaved } from '@/src/events/profileSettingsEvents'
import {
  invalidateTodayDailyWord,
  upsertUserProfileSettings,
} from '@/src/features/profile/services/profile.service'
import { getAuthenticatedUserId } from '@/src/services/auth/ensureSession'
import { setOnboardingComplete } from '@/src/services/storage/onboardingStorage'
import { syncWidgetSnapshotFromApp } from '@/src/services/widgets/syncWidgetSnapshot'

export async function completeOnboardingFromDraft(
  draft: OnboardingDraft,
  markOnboardingComplete: () => void,
): Promise<{ ok: true } | { ok: false }> {
  const uid = await getAuthenticatedUserId();
  if (!uid) {
    Alert.alert(
      'Brak sesji',
      'Nie jesteś zalogowany. Wróć na początek onboardingu i zaloguj się przez Google lub Apple.',
    );
    return { ok: false };
  }

  if (!draft.nativeLanguageId || !draft.learningLanguageId) {
    Alert.alert('Missing data', 'Please select both languages.')
    return { ok: false }
  }
  if (draft.nativeLanguageId === draft.learningLanguageId) {
    Alert.alert('Invalid selection', 'Native and learning language must be different.')
    return { ok: false }
  }
  if (draft.learningModeType === 'difficulty' && !draft.learningLevel) {
    Alert.alert('Missing data', 'Please select your difficulty level.')
    return { ok: false }
  }
  if (draft.learningModeType === 'category' && !draft.selectedCategoryId) {
    Alert.alert('Missing data', 'Please select a category.')
    return { ok: false }
  }

  await upsertUserProfileSettings({
    p_native_language_id: draft.nativeLanguageId,
    p_learning_language_id: draft.learningLanguageId,
    p_learning_mode_type: draft.learningModeType,
    p_learning_level:
      draft.learningModeType === 'difficulty' ? draft.learningLevel ?? undefined : undefined,
    p_selected_category_id:
      draft.learningModeType === 'category' ? draft.selectedCategoryId ?? undefined : undefined,
  })
  await invalidateTodayDailyWord()
  emitProfileSettingsSaved()
  await setOnboardingComplete();
  markOnboardingComplete();
  await syncWidgetSnapshotFromApp();
  return { ok: true };
}
