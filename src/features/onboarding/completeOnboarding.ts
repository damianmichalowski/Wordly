import { Alert } from 'react-native'

import type { OnboardingDraft } from '@/src/features/onboarding/OnboardingProvider'
import {
  getOnboardingOptions,
  invalidateTodayDailyWord,
  upsertUserProfileSettings,
} from '@/src/features/profile/services/profile.service'
import { appUiLocaleFromNativeLanguage } from '@/src/features/profile/types/profile.types'
import { applyAppLocale, i18n } from '@/src/i18n/i18n'
import { setCachedAppLocale } from '@/src/i18n/uiLocaleStorage'
import { invalidateAfterProfileOrSettingsChange } from '@/src/lib/query/invalidateAfterMutations'
import { queryClient } from '@/src/lib/query/queryClient'
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
      i18n.t('onboarding.alerts.noSessionTitle'),
      i18n.t('onboarding.alerts.noSessionBody'),
    );
    return { ok: false };
  }

  if (!draft.nativeLanguageId || !draft.learningLanguageId) {
    Alert.alert(
      i18n.t('onboarding.alerts.missingDataTitle'),
      i18n.t('onboarding.alerts.missingDataBody'),
    );
    return { ok: false };
  }
  if (draft.nativeLanguageId === draft.learningLanguageId) {
    Alert.alert(
      i18n.t('onboarding.alerts.invalidSelectionTitle'),
      i18n.t('onboarding.alerts.invalidSelectionBody'),
    );
    return { ok: false };
  }
  if (draft.learningModeType === 'difficulty' && !draft.learningLevel) {
    Alert.alert(
      i18n.t('onboarding.alerts.missingLevelTitle'),
      i18n.t('onboarding.alerts.missingLevelBody'),
    );
    return { ok: false };
  }
  if (draft.learningModeType === 'category' && !draft.selectedCategoryId) {
    Alert.alert(
      i18n.t('onboarding.alerts.missingCategoryTitle'),
      i18n.t('onboarding.alerts.missingCategoryBody'),
    );
    return { ok: false };
  }

  const options = await getOnboardingOptions();
  const native = options.languages.find((l) => l.id === draft.nativeLanguageId);
  if (!native) {
    Alert.alert(
      i18n.t('onboarding.alerts.missingDataTitle'),
      i18n.t('onboarding.alerts.missingDataBody'),
    );
    return { ok: false };
  }
  const uiLocale = appUiLocaleFromNativeLanguage(native);

  await upsertUserProfileSettings({
    p_native_language_id: draft.nativeLanguageId,
    p_learning_language_id: draft.learningLanguageId,
    p_learning_mode_type: draft.learningModeType,
    p_learning_level:
      draft.learningModeType === 'difficulty' ? draft.learningLevel ?? undefined : undefined,
    p_selected_category_id:
      draft.learningModeType === 'category' ? draft.selectedCategoryId ?? undefined : undefined,
  });
  await applyAppLocale(uiLocale);
  await setCachedAppLocale(uiLocale);
  await invalidateTodayDailyWord()
  invalidateAfterProfileOrSettingsChange(queryClient)
  await setOnboardingComplete();
  markOnboardingComplete();
  await syncWidgetSnapshotFromApp();
  return { ok: true };
}
