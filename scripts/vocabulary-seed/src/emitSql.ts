import { v5 as uuidv5 } from 'uuid';

import { escapeSqlLiteral, sqlFooter, sqlHeader } from './sql';
import type { MergedLexeme } from './merge';
import { lexemeKey, type TranslationRow } from './types';
import { senseDedupKey } from './translations';
import type { SchemaPos } from './posMap';

/** Stabilne namespace UUID (v5) — deterministyczne id przy tym samym inpucie. */
const LEMMA_NS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const SENSE_NS = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

function normLemma(s: string): string {
  return s.trim().toLowerCase();
}

function normGloss(s: string): string {
  return s.trim().toLowerCase();
}

export function lemmaUuid(sourceLang: string, lemma: string): string {
  return uuidv5(`${sourceLang}:${normLemma(lemma)}`, LEMMA_NS);
}

export function senseUuid(
  sourceLang: string,
  lemma: string,
  targetLang: string,
  pos: SchemaPos,
  gloss: string,
): string {
  return uuidv5(
    `${sourceLang}:${normLemma(lemma)}:${targetLang}:${pos}:${normGloss(gloss)}`,
    SENSE_NS,
  );
}

export type EmitInput = {
  merged: Map<string, MergedLexeme>;
  translations: TranslationRow[];
  sourceLanguageCode: string;
  targetLanguageCode: string;
  reportMissingMeta: string[];
};

export function buildEmitSql(input: EmitInput): string {
  const { merged, translations, sourceLanguageCode, targetLanguageCode } = input;

  const senses: {
    lemmaDisplay: string;
    partOfSpeech: SchemaPos;
    cefrLevel: string;
    glossPl: string;
  }[] = [];

  const seenSense = new Set<string>();

  for (const t of translations) {
    const key = lexemeKey(t.lemma, t.partOfSpeech);
    const meta = merged.get(key);
    if (!meta) {
      input.reportMissingMeta.push(`${t.lemma} (${t.partOfSpeech}) → ${t.glossPl}`);
      continue;
    }
    const sk = senseDedupKey(t.lemma, t.partOfSpeech, t.glossPl);
    if (seenSense.has(sk)) {
      continue;
    }
    seenSense.add(sk);
    senses.push({
      lemmaDisplay: meta.lemmaDisplay,
      partOfSpeech: t.partOfSpeech,
      cefrLevel: meta.cefrLevel,
      glossPl: t.glossPl,
    });
  }

  const byLemma = new Map<string, typeof senses>();
  for (const s of senses) {
    const lid = lemmaUuid(sourceLanguageCode, s.lemmaDisplay);
    if (!byLemma.has(lid)) {
      byLemma.set(lid, []);
    }
    byLemma.get(lid)!.push(s);
  }

  for (const [, list] of byLemma) {
    list.sort((a, b) => {
      const c = a.partOfSpeech.localeCompare(b.partOfSpeech);
      if (c !== 0) {
        return c;
      }
      return a.glossPl.localeCompare(b.glossPl, 'pl');
    });
  }

  const lines: string[] = [];
  lines.push(
    sqlHeader([
      'Wygenerowane przez scripts/vocabulary-seed',
      'Nie edytuj ręcznie — wygeneruj ponownie skryptem.',
      `Lematów (unikalnych): ${String(byLemma.size)}`,
      `Sensów (wierszy): ${String(senses.length)}`,
    ]).trim(),
  );

  for (const [lemmaId, list] of byLemma) {
    const first = list[0];
    const le = escapeSqlLiteral(first.lemmaDisplay);
    lines.push(
      `insert into public.vocabulary_lemmas (id, source_language_code, lemma_text, pronunciation_text) values ('${lemmaId}', '${sourceLanguageCode}', '${le}', null) on conflict (id) do nothing;`,
    );
  }

  for (const [lemmaId, list] of byLemma) {
    list.forEach((s, senseIndex) => {
      const sid = senseUuid(
        sourceLanguageCode,
        s.lemmaDisplay,
        targetLanguageCode,
        s.partOfSpeech,
        s.glossPl,
      );
      const g = escapeSqlLiteral(s.glossPl);
      // Jedno ON CONFLICT nie obsłuży jednocześnie: (1) ten sam id co w migracji seed, (2) ten sam slot z innym id.
      // INSERT … SELECT … WHERE NOT EXISTS — pomija oba przypadki bez 23505.
      lines.push(
        `insert into public.vocabulary_senses (id, lemma_id, target_language_code, part_of_speech, gloss_text, cefr_level, sense_index, category) select '${sid}', '${lemmaId}', '${targetLanguageCode}', '${s.partOfSpeech}', '${g}', '${s.cefrLevel}', ${String(senseIndex)}, null where not exists (select 1 from public.vocabulary_senses vs where vs.id = '${sid}') and not exists (select 1 from public.vocabulary_senses vs where vs.lemma_id = '${lemmaId}' and vs.target_language_code = '${targetLanguageCode}' and vs.sense_index = ${String(senseIndex)});`,
      );
    });
  }

  lines.push(sqlFooter().trim());
  return `${lines.join('\n')}\n`;
}
