import { normalizeToAppLocale } from '@/src/i18n/resolveLocale'

export type OnboardingLanguage = {
  id: string
  code: string
  name: string
}

export type OnboardingCategory = {
  id: string
  code: string
  name: string
  description: string | null
}

export type LearningModeType = 'difficulty' | 'category'
export type LearningLevel = 'beginner' | 'intermediate' | 'advanced'

/** App UI + translation locale (en | pl), derived from `native_language.code`. */
export type AppUiLocale = 'en' | 'pl'

export function appUiLocaleFromNativeLanguage(
  native: Pick<OnboardingLanguage, 'code'>,
): AppUiLocale {
  return normalizeToAppLocale(native.code)
}

export type OnboardingOptionItem = {
  value: string
  label: string
}

export type OnboardingOptions = {
  languages: OnboardingLanguage[]
  categories: OnboardingCategory[]
  learningModeTypes: OnboardingOptionItem[]
  learningLevels: OnboardingOptionItem[]
}

export type UserProfileSettings = {
  user_id: string
  native_language: OnboardingLanguage
  learning_language: OnboardingLanguage
  learning_mode_type: LearningModeType
  learning_level: LearningLevel | null
  selected_category: OnboardingCategory | null
  last_daily_revision_date: string | null
  created_at: string
}

export type UpsertUserProfileSettingsInput = {
  p_native_language_id: string
  p_learning_language_id: string
  p_learning_mode_type: LearningModeType
  p_learning_level?: LearningLevel
  p_selected_category_id?: string
}
