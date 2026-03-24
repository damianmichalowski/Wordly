import type { SchemaPos } from './posMap';

export type RawLexemeRow = {
  lemma: string;
  partOfSpeech: SchemaPos;
  cefrLevel: string;
  sourceLabel: string;
};

/** Klucz deduplikacji metadanych (przed dołączeniem tłumaczenia): ten sam wyraz + ta sama część mowy. */
export type LexemeKey = string;

export function lexemeKey(lemma: string, pos: SchemaPos): LexemeKey {
  return `${lemma.trim().toLowerCase()}|${pos}`;
}

export type TranslationRow = {
  lemma: string;
  partOfSpeech: SchemaPos;
  glossPl: string;
};
