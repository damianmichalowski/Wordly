import type { CefrLevel } from '@/src/types/cefr';
import type { LanguageCode } from '@/src/types/language';

export type VocabularyWord = {
  id: string;
  sourceLanguageCode: LanguageCode;
  targetLanguageCode: LanguageCode;
  sourceText: string;
  /** Gloss bieżącego sensu. */
  targetText: string;
  /** Wszystkie glossy lematu (gdy sensów > 1) do formatowanego wyświetlania. */
  targetGlossParts?: string[];
  exampleSource: string;
  exampleTarget: string;
  cefrLevel: CefrLevel;
  /** `vocabulary_senses.part_of_speech` (np. noun, verb) z widoku `vocabulary_sense_display`. */
  partOfSpeech?: string;
  /** `vocabulary_lemmas.id` do łączenia sensów tego samego hasła. */
  lemmaId?: string;
  pronunciationText?: string;
  audioUrl?: string | null;
  deck?: string | null;
};

/** Jedna linia tłumaczenia (np. widżet, wyszukiwarka): sensy oddzielone „ · ”. */
export function vocabularyWordDisplayTargetText(w: VocabularyWord): string {
  if (w.targetGlossParts && w.targetGlossParts.length > 1) {
    return w.targetGlossParts.join(" · ");
  }
  return w.targetText;
}
