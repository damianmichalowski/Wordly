import { parse } from 'csv-parse/sync';

import { mapPartOfSpeech } from '../posMap';
import { normalizeCefr } from '../cefr';
import type { RawLexemeRow } from '../types';

/**
 * Ogólny CSV z nagłówkami — dopasowuje kolumny po nazwie (case-insensitive).
 * Obsługiwane warianty: headword|word|lemma|source_text ; pos|part_of_speech ; CEFR|cefr|level
 */
export function parseGenericLexiconCsv(content: string, sourceLabel: string): RawLexemeRow[] {
  const text = content.replace(/^\uFEFF/, '');
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  const out: RawLexemeRow[] = [];
  for (const r of rows) {
    const keys = Object.keys(r);
    const lower = (name: string) => keys.find((k) => k.toLowerCase() === name.toLowerCase());

    const lemmaCol = lower('headword') ?? lower('word') ?? lower('lemma') ?? lower('source_text');
    const posCol = lower('pos') ?? lower('part_of_speech') ?? lower('partofspeech');
    const cefrCol = lower('CEFR') ?? lower('cefr') ?? lower('level') ?? lower('cefr_level');

    const headword = lemmaCol ? r[lemmaCol]?.trim() : undefined;
    const posRaw = posCol ? r[posCol]?.trim() : undefined;
    const cefrRaw = cefrCol ? r[cefrCol]?.trim() : undefined;

    if (!headword || !cefrRaw) {
      continue;
    }
    if (!posRaw) {
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
