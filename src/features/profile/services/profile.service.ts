import { rpc } from '@/src/lib/supabase/rpc'

import type {
  OnboardingOptions,
  UserProfileSettings,
  UpsertUserProfileSettingsInput,
} from '../types/profile.types'

export async function getOnboardingOptions(): Promise<OnboardingOptions> {
  const { data, error } = await rpc('get_onboarding_options')

  if (error) {
    throw new Error(`Failed to get onboarding options: ${error.message}`)
  }

  if (!data) {
    throw new Error('Onboarding options not found')
  }

  return data as OnboardingOptions
}

export async function getUserProfileSettings(): Promise<UserProfileSettings | null> {
  const { data, error } = await rpc('get_user_profile_settings')

  if (error) {
    throw new Error(`Failed to get user profile settings: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return data as UserProfileSettings
}

export async function upsertUserProfileSettings(
  input: UpsertUserProfileSettingsInput,
): Promise<UserProfileSettings> {
  const { data, error } = await rpc('upsert_user_profile_settings', input)

  if (error) {
    throw new Error(`Failed to upsert user profile settings: ${error.message}`)
  }

  if (!data) {
    throw new Error('Profile settings were not returned')
  }

  return data as UserProfileSettings
}

/** Usuwa dzisiejszą pozycję w user_daily_word, po zmianie trybu nauki kolejne get_or_create_daily_word wylosuje nowe słowo. */
export async function invalidateTodayDailyWord(): Promise<void> {
  const { error } = await rpc('invalidate_today_daily_word')

  if (error) {
    throw new Error(`Failed to reset today's daily word: ${error.message}`)
  }
}
