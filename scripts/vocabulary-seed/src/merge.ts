import { pickHarderCefr } from './cefr';
import { lexemeKey, type RawLexemeRow } from './types';
import type { SchemaPos } from './posMap';

export type MergedLexeme = {
  lemmaDisplay: string;
  partOfSpeech: SchemaPos;
  cefrLevel: string;
  /** Źródło o najwyższym priorytecie (dla CEFR przy konflikcie). */
  winningSource: string;
};

/**
 * Scala wiele plików (Oxford, CEFR-J, 10k…) do jednego wpisu na (lemma, POS).
 * Wyższy `sourcePriority` = przy konflikcie CEFR bierzemy CEFR z tego źródła.
 * Przy zgodnym priorytecie: trudniejszy poziom.
 */
export function mergeLexemeRows(
  rows: RawLexemeRow[],
  sourcePriority: Record<string, number>,
): Map<string, MergedLexeme> {
  type Agg = {
    lemmaDisplay: string;
    partOfSpeech: SchemaPos;
    cefrLevel: string;
    priority: number;
    winningSource: string;
  };

  const map = new Map<string, Agg>();

  for (const row of rows) {
    const key = lexemeKey(row.lemma, row.partOfSpeech);
    const p = sourcePriority[row.sourceLabel] ?? 0;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        lemmaDisplay: row.lemma,
        partOfSpeech: row.partOfSpeech,
        cefrLevel: row.cefrLevel,
        priority: p,
        winningSource: row.sourceLabel,
      });
      continue;
    }

    if (p > existing.priority) {
      existing.cefrLevel = row.cefrLevel;
      existing.priority = p;
      existing.winningSource = row.sourceLabel;
      existing.lemmaDisplay = row.lemma;
    } else {
      existing.cefrLevel = pickHarderCefr(existing.cefrLevel, row.cefrLevel);
    }
  }

  const out = new Map<string, MergedLexeme>();
  for (const [k, v] of map) {
    out.set(k, {
      lemmaDisplay: v.lemmaDisplay,
      partOfSpeech: v.partOfSpeech,
      cefrLevel: v.cefrLevel,
      winningSource: v.winningSource,
    });
  }
  return out;
}
