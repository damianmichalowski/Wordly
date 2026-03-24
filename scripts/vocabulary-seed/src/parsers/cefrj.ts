import { parse } from 'csv-parse/sync';

import { mapPartOfSpeech } from '../posMap';
import { normalizeCefr } from '../cefr';
import type { RawLexemeRow } from '../types';

/**
 * CEFR-J Open Language Profiles (np. `cefrj-vocabulary-profile-1.5.csv`):
 * headword,pos,CEFR,CoreInventory 1,CoreInventory 2,Threshold
 */
export function parseCefrjCsv(content: string, sourceLabel: string): RawLexemeRow[] {
  const text = content.replace(/^\uFEFF/, '');
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  const out: RawLexemeRow[] = [];
  for (const r of rows) {
    const headword = r.headword?.trim();
    const posRaw = r.pos?.trim();
    const cefrRaw = r.CEFR?.trim() ?? r.cefr?.trim();
    if (!headword || !posRaw || !cefrRaw) {
      continue;
    }
    const pos = mapPartOfSpeech(posRaw);
    const cefr = normalizeCefr(cefrRaw);
    if (!pos || !cefr) {
      continue;
    }
    out.push({
      lemma: headword,
      partOfSpeech: pos,
      cefrLevel: cefr,
      sourceLabel,
    });
  }
  return out;
}
