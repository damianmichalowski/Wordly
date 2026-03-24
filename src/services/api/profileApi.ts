import { getSupabaseClient, hasSupabaseEnv } from '@/src/lib/supabase/client';
import { getAuthenticatedUserId } from '@/src/services/auth/ensureSession';
import { getUserProfile, saveUserProfile } from '@/src/services/storage/profileStorage';
import type { UserProfile } from '@/src/types/profile';

/** Po zalogowaniu (np. anon) ujednolicaj `userId` w lokalnym profilu z `auth.uid()`. */
export async function syncStoredProfileUserIdWithAuth(): Promise<void> {
  const uid = await getAuthenticatedUserId();
  if (!uid) {
    return;
  }
  const profile = await getUserProfile();
  if (profile && profile.userId !== uid) {
    await saveUserProfile({ ...profile, userId: uid, updatedAt: new Date().toISOString() });
  }
}

export async function upsertProfileToSupabase(profile: UserProfile): Promise<void> {
  if (!hasSupabaseEnv()) {
    return;
  }

  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    return;
  }

  await supabase.from('profiles').upsert(
    {
      user_id: user.id,
      source_language_code: profile.languagePair.sourceLanguage,
      target_language_code: profile.languagePair.targetLanguage,
      current_level: profile.currentLevel,
      configured_display_level: profile.displayLevel,
      display_level_policy: profile.displayLevelPolicy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
}
