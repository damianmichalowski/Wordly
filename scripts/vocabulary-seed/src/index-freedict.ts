/**
 * Buduje duży plik SQL z:
 * - FreeDict English–Polish (https://github.com/freedict/fd-dictionaries, eng-pol, GNU GPL / GFDL)
 * - poziomów CEFR z CEFR-J OLP tam, gdzie da się dopasować (lemma + POS)
 * - brak CEFR → domyślnie B1
 *
 * Uruchomienie (z katalogu głównego repo):
 *   npx tsx scripts/vocabulary-seed/src/index-freedict.ts --limit 10000
 *   npx tsx scripts/vocabulary-seed/src/index-freedict.ts --all
 *   (--all = wszystkie sensy po deduplikacji, ~39k; większy plik SQL)
 */
import fs from 'fs';
import path from 'path';

import { buildEmitSql } from './emitSql';
import { parseEngPolLetterXml } from './freedict/parseEngPolLetterXml';
import { mergeLexemeRows } from './merge';
import { parseCefrjCsv } from './parsers/cefrj';
import { senseDedupKey } from './translations';
import { lexemeKey, type TranslationRow } from './types';
import type { MergedLexeme } from './merge';

const FREEDICT_BASE =
  'https://raw.githubusercontent.com/freedict/fd-dictionaries/master/eng-pol/letters';
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

function getArg(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i >= 0 && argv[i + 1]) {
    return argv[i + 1];
  }
  return undefined;
}

function ensureMergedForTranslations(
  cefrjMerged: Map<string, MergedLexeme>,
  translations: TranslationRow[],
): Map<string, MergedLexeme> {
  const out = new Map(cefrjMerged);
  for (const t of translations) {
    const k = lexemeKey(t.lemma, t.partOfSpeech);
    if (!out.has(k)) {
      out.set(k, {
        lemmaDisplay: t.lemma,
        partOfSpeech: t.partOfSpeech,
        cefrLevel: 'B1',
        winningSource: 'cefr-fallback',
      });
    }
  }
  return out;
}

function dedupeTranslations(rows: TranslationRow[]): TranslationRow[] {
  const seen = new Set<string>();
  const out: TranslationRow[] = [];
  for (const r of rows) {
    const k = senseDedupKey(r.lemma, r.partOfSpeech, r.glossPl);
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    out.push(r);
  }
  return out;
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${String(res.status)} ${url}`);
  }
  const buf = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buf));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const useAll = argv.includes('--all');
  const outPath =
    getArg(argv, '--out') ??
    path.join(
      'supabase',
      'seeds',
      'generated',
      useAll ? 'wordly_freedict_full.sql' : 'wordly_freedict_10k.sql',
    );
  const cefrjPath =
    getArg(argv, '--cefrj') ?? path.join('scripts', 'vocabulary-seed', 'data', 'raw', 'cefrj-vocabulary-profile-1.5.csv');
  const freedictDir =
    getArg(argv, '--freedict-dir') ?? path.join('scripts', 'vocabulary-seed', 'data', 'raw', 'freedict-eng-pol');
  const limitArg = getArg(argv, '--limit');
  const limitParsed = parseInt(limitArg ?? '10000', 10);
  const skipDownload = argv.includes('--no-download');

  const absCefrj = path.resolve(cefrjPath);
  if (!fs.existsSync(absCefrj)) {
    console.error(`Brak pliku CEFR-J: ${absCefrj}`);
    console.error('Pobierz np.: curl -o ... https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv');
    process.exit(1);
  }

  fs.mkdirSync(freedictDir, { recursive: true });

  if (!skipDownload) {
    for (const L of LETTERS) {
      const dest = path.join(freedictDir, `${L}.xml`);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 500) {
        continue;
      }
      const url = `${FREEDICT_BASE}/${L}.xml`;
      console.error(`Pobieranie ${url} …`);
      await downloadFile(url, dest);
    }
  }

  const allRows: TranslationRow[] = [];
  for (const L of LETTERS) {
    const p = path.join(freedictDir, `${L}.xml`);
    if (!fs.existsSync(p)) {
      console.error(`Brak pliku ${p} — użyj bez --no-download`);
      continue;
    }
    const xml = fs.readFileSync(p, 'utf-8');
    const part = parseEngPolLetterXml(xml);
    allRows.push(...part);
    console.error(`  ${L}.xml → ${String(part.length)} tłumaczeń (surowych)`);
  }

  const deduped = dedupeTranslations(allRows);
  deduped.sort((a, b) => {
    const la = a.lemma.toLowerCase().localeCompare(b.lemma.toLowerCase());
    if (la !== 0) {
      return la;
    }
    const lp = a.partOfSpeech.localeCompare(b.partOfSpeech);
    if (lp !== 0) {
      return lp;
    }
    return a.glossPl.localeCompare(b.glossPl, 'pl');
  });

  const capped = useAll
    ? deduped
    : deduped.slice(0, Math.max(1, Number.isFinite(limitParsed) ? limitParsed : 10000));
  console.error(
    `Po deduplikacji: ${String(deduped.length)} → ${String(capped.length)} wierszy SQL${useAll ? ' (--all)' : ` (--limit ${String(limitParsed)})`}.`,
  );

  const cefrjRows = parseCefrjCsv(fs.readFileSync(absCefrj, 'utf-8'), 'cefrj');
  const cefrjMerged = mergeLexemeRows(cefrjRows, { cefrj: 50 });
  const merged = ensureMergedForTranslations(cefrjMerged, capped);

  const reportMissingMeta: string[] = [];
  const sql = buildEmitSql({
    merged,
    translations: capped,
    sourceLanguageCode: 'en',
    targetLanguageCode: 'pl',
    reportMissingMeta,
  });

  const outAbs = path.resolve(outPath);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, sql, 'utf-8');

  const reportPath = outAbs.replace(/\.sql$/i, '') + '.report.txt';
  fs.writeFileSync(
    reportPath,
    [
      'Źródła tłumaczeń: FreeDict eng-pol (GitHub freedict/fd-dictionaries, GPL/GFDL).',
      'Źródła CEFR: CEFR-J OLP (gdzie pasuje lemma+POS); inaczej B1.',
      `Wierszy w SQL: ${String(capped.length)}`,
      `Brak metadanych CEFR/POS dla tłumaczenia: ${String(reportMissingMeta.length)}`,
    ].join('\n'),
    'utf-8',
  );

  console.error(`OK: ${outAbs}`);
  console.error(`Raport: ${reportPath}`);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
