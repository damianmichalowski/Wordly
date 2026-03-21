import { hasSupabaseEnv, getSupabaseClient } from '@/src/lib/supabase/client';
import type { UserProfile } from '@/src/types/profile';

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
