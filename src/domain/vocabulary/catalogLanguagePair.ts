import type { LanguageCode } from '@/src/types/language';
import type { UserProfile } from '@/src/types/profile';

/**
 * W `vocabulary_sense_display` / tabelach katalogu:
 * - `source_language_code` = język **lematu** (słowo w formie, którą się uczy),
 * - `target_language_code` = język **glossu** (tłumaczenie / wyjaśnienie).
 *
 * W profilu użytkownika (onboarding):
 * - `sourceLanguage` = język **ojczysty** (native),
 * - `targetLanguage` = język **nauki** (np. angielski).
 *
 * Przykład: native PL, nauka EN → w bazie szukamy pary **en → pl** (angielskie lematy, polskie gloss),
 * zgodnie z seedem (`en` lemmas, `pl` senses).
 */
export function getCatalogLanguagePair(profile: UserProfile): {
  lemmaLanguageCode: LanguageCode;
  glossLanguageCode: LanguageCode;
} {
  return {
    lemmaLanguageCode: profile.languagePair.targetLanguage,
    glossLanguageCode: profile.languagePair.sourceLanguage,
  };
}
