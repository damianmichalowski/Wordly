import { parse } from 'csv-parse/sync';

import { mapPartOfSpeech } from './posMap';
import type { SchemaPos } from './posMap';
import type { TranslationRow } from './types';

/**
 * CSV tłumaczeń EN → PL (lub inna para docelowa w `gloss_text`):
 * headword,pos,gloss_pl
 *
 * Wiele wierszy z tym samym headword+pos = różne znaczenia (tak jak w bazie).
 */
export function parseTranslationCsv(content: string): TranslationRow[] {
  const text = content.replace(/^\uFEFF/, '');
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  const out: TranslationRow[] = [];
  for (const r of rows) {
    const keys = Object.keys(r);
    const lower = (name: string) => keys.find((k) => k.toLowerCase() === name.toLowerCase());

    const lemmaCol = lower('headword') ?? lower('word') ?? lower('lemma');
    const posCol = lower('pos') ?? lower('part_of_speech');
    const glossCol =
      lower('gloss_pl') ?? lower('gloss') ?? lower('target_text') ?? lower('translation') ?? lower('pl');

    const lemma = lemmaCol ? r[lemmaCol]?.trim() : undefined;
    const posRaw = posCol ? r[posCol]?.trim() : undefined;
    const gloss = glossCol ? r[glossCol]?.trim() : undefined;

    if (!lemma || !posRaw || !gloss) {
      continue;
    }
    const pos = mapPartOfSpeech(posRaw);
    if (!pos) {
      continue;
    }
    out.push({ lemma, partOfSpeech: pos, glossPl: gloss });
  }
  return out;
}

export function senseDedupKey(lemma: string, pos: SchemaPos, glossPl: string): string {
  return `${lemma.trim().toLowerCase()}|${pos}|${glossPl.trim().toLowerCase()}`;
}
