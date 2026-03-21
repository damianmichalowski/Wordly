import * as Speech from 'expo-speech';

import type { LanguageCode } from '@/src/types/language';
import type { VocabularyWord } from '@/src/types/words';

const languageToLocale: Record<LanguageCode, string> = {
  pl: 'pl-PL',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
};

export function canPronounce(word: VocabularyWord | null | undefined) {
  if (!word) {
    return false;
  }
  return Boolean(word.pronunciationText?.trim() || word.targetText?.trim());
}

export async function speakWord(word: VocabularyWord): Promise<void> {
  const text = word.pronunciationText?.trim() || word.targetText?.trim();
  if (!text) {
    return;
  }

  const locale = languageToLocale[word.targetLanguageCode] ?? 'en-US';
  Speech.stop();
  Speech.speak(text, {
    language: locale,
    rate: 0.95,
  });
}

export function stopSpeaking() {
  Speech.stop();
}
