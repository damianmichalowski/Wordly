import { Alert } from 'react-native';

import type { OnboardingDraft } from '@/src/features/onboarding/OnboardingProvider';
import { deriveDisplayLevel } from '@/src/domain/userProfile/levelMapping';
import { upsertProfileToSupabase } from '@/src/services/api/profileApi';
import { getAuthenticatedUserId } from '@/src/services/auth/ensureSession';
import { setOnboardingComplete } from '@/src/services/storage/onboardingStorage';
import { saveUserProfile } from '@/src/services/storage/profileStorage';
import { syncWidgetSnapshotFromApp } from '@/src/services/widgets/syncWidgetSnapshot';
import type { UserProfile } from '@/src/types/profile';

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

  const displayLevel = deriveDisplayLevel(draft.currentLevel, draft.displayLevelPolicy);
  const now = new Date().toISOString();
  const profile: UserProfile = {
    userId: uid,
    languagePair: {
      sourceLanguage: draft.sourceLanguage,
      targetLanguage: draft.targetLanguage,
    },
    currentLevel: draft.currentLevel,
    displayLevel,
    displayLevelPolicy: draft.displayLevelPolicy,
    createdAt: now,
    updatedAt: now,
  };

  await saveUserProfile(profile);
  await upsertProfileToSupabase(profile);
  await setOnboardingComplete();
  markOnboardingComplete();
  await syncWidgetSnapshotFromApp();
  return { ok: true };
}
