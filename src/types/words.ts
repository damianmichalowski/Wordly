import type { CefrLevel } from '@/src/types/cefr';
import type { LanguageCode } from '@/src/types/language';

export type VocabularyWordCategory = {
  id: string;
  code: string;
  name: string;
};

export type VocabularyWord = {
  id: string;
  sourceLanguageCode: LanguageCode;
  targetLanguageCode: LanguageCode;
  sourceText: string;
  /** Gloss bieżącego sensu. */
  targetText: string;
  /** Wszystkie glossy lematu (gdy sensów > 1) do formatowanego wyświetlania. */
  targetGlossParts?: string[];
  /** Do 3 przykładów (np. fiszki powtórki), gdy brak, używamy `exampleSource`. */
  exampleParts?: string[];
  exampleSource: string;
  exampleTarget: string;
  cefrLevel: CefrLevel;
  categories?: VocabularyWordCategory[];
  /** ISO z `user_word_progress.known_at`, sortowanie listy biblioteki. */
  knownAt?: string | null;
  /** `vocabulary_senses.part_of_speech` (np. noun, verb) z widoku `vocabulary_sense_display`. */
  partOfSpeech?: string;
  /** `vocabulary_lemmas.id` do łączenia sensów tego samego hasła. */
  lemmaId?: string;
  pronunciationText?: string;
  audioUrl?: string | null;
  deck?: string | null;
  /** `user_word_progress.is_difficult === true` */
  isDifficult?: boolean;
  /** `user_word_progress.difficult_correct_streak` (0–3 in difficult-words sessions). */
  difficultCorrectStreak?: number;
  /** `user_word_progress.difficult_dont_know_counter` — 2+ auto-marks difficult. */
  difficultDontKnowCounter?: number;
  /** `user_word_progress.next_review_at` ISO timestamp or null. */
  nextReviewAt?: string | null;
  /** `user_word_progress.interval_days` — current SRS interval. */
  intervalDays?: number;
};

/** Jedna linia tłumaczenia (np. widżet, wyszukiwarka): sensy oddzielone „ · ”. */
export function vocabularyWordDisplayTargetText(w: VocabularyWord): string {
  if (w.targetGlossParts && w.targetGlossParts.length > 1) {
    return w.targetGlossParts.join(" · ");
  }
  return w.targetText;
}
