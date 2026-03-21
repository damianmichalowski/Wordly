import type { CefrLevel } from '@/src/types/cefr';
import type { LanguageCode } from '@/src/types/language';

export type VocabularyWord = {
  id: string;
  sourceLanguageCode: LanguageCode;
  targetLanguageCode: LanguageCode;
  sourceText: string;
  targetText: string;
  exampleSource: string;
  exampleTarget: string;
  cefrLevel: CefrLevel;
  pronunciationText?: string;
  audioUrl?: string | null;
  deck?: string | null;
};
