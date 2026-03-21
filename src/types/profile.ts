import type { CefrLevel } from '@/src/types/cefr';
import type { LanguageCode } from '@/src/types/language';

export type DisplayLevelPolicy = 'next-level' | 'same-level' | 'advanced-mixed';

export type LanguagePair = {
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
};

export type UserProfile = {
  userId: string;
  languagePair: LanguagePair;
  currentLevel: CefrLevel;
  displayLevel: CefrLevel;
  displayLevelPolicy: DisplayLevelPolicy;
  createdAt: string;
  updatedAt: string;
};
