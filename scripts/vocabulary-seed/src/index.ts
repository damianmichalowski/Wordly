/**
 * ETL: łączy listy słów (CEFR-J OLP, Oxford 3000/5000, Words-CEFR, 10k CEFR…) + plik tłumaczeń → SQL do Supabase.
 *
 * Przykład:
 * npx tsx scripts/vocabulary-seed/src/index.ts \
 *   --cefrj scripts/vocabulary-seed/sample-data/cefrj-vocabulary-profile-1.5.sample.csv \
 *   --translations scripts/vocabulary-seed/sample-data/en-pl.example.csv \
 *   --source-lang en --target-lang pl \
 *   --out supabase/seeds/generated/wordly_seed.sql
 */
import fs from 'fs';
import path from 'path';

import { parseCefrjCsv } from './parsers/cefrj';
import { parseGenericLexiconCsv } from './parsers/generic';
import { mergeLexemeRows } from './merge';
import { parseTranslationCsv } from './translations';
import { buildEmitSql } from './emitSql';
import type { RawLexemeRow } from './types';

const DEFAULT_PRIORITY: Record<string, number> = {
  oxford5000: 100,
  oxford3000: 95,
  '10k_cefr': 60,
  words_cefr: 55,
  cefrj: 50,
  generic: 10,
};

function readFile(p: string): string {
  return fs.readFileSync(path.resolve(p), 'utf-8');
}

function parseGenericArg(value: string): { path: string; label: string } {
  const idx = value.lastIndexOf(':');
  if (idx <= 0 || idx === value.length - 1) {
    return { path: value, label: 'generic' };
  }
  return {
    path: value.slice(0, idx),
    label: value.slice(idx + 1),
  };
}

function getFlagValues(argv: string[], flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === flag && argv[i + 1]) {
      out.push(argv[i + 1]);
    }
  }
  return out;
}

function getSingle(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i >= 0 && argv[i + 1]) {
    return argv[i + 1];
  }
  return undefined;
}

function main(): void {
  const argv = process.argv.slice(2);

  const cefrjPaths = getFlagValues(argv, '--cefrj');
  const genericPaths = getFlagValues(argv, '--generic');
  const translationsPath = getSingle(argv, '--translations');
  const outPath = getSingle(argv, '--out');
  const sourceLang = getSingle(argv, '--source-lang') ?? 'en';
  const targetLang = getSingle(argv, '--target-lang') ?? 'pl';
  const prioritiesPath = getSingle(argv, '--priorities');

  if (!translationsPath || !outPath) {
    console.error(
      `Użycie:\n  npx tsx scripts/vocabulary-seed/src/index.ts \\\n    [--cefrj ścieżka]... [--generic ścieżka:etykieta]... \\\n    --translations ścieżka/en-pl.csv \\\n    --out ścieżka/wyjście.sql \\\n    [--source-lang en] [--target-lang pl] \\\n    [--priorities priorities.json]\n`,
    );
    process.exit(1);
  }

  let sourcePriority: Record<string, number> = { ...DEFAULT_PRIORITY };
  if (prioritiesPath) {
    const raw = readFile(prioritiesPath);
    sourcePriority = { ...sourcePriority, ...JSON.parse(raw) };
  }

  const rows: RawLexemeRow[] = [];

  for (const p of cefrjPaths) {
    const text = readFile(p);
    rows.push(...parseCefrjCsv(text, 'cefrj'));
  }

  for (const g of genericPaths) {
    const { path: filePath, label } = parseGenericArg(g);
    const text = readFile(filePath);
    rows.push(...parseGenericLexiconCsv(text, label));
  }

  if (rows.length === 0) {
    console.error('Brak wierszy z --cefrj / --generic. Podaj przynajmniej jeden plik źródłowy.');
    process.exit(1);
  }

  const merged = mergeLexemeRows(rows, sourcePriority);
  const translations = parseTranslationCsv(readFile(translationsPath));

  const reportMissingMeta: string[] = [];
  const sql = buildEmitSql({
    merged,
    translations,
    sourceLanguageCode: sourceLang,
    targetLanguageCode: targetLang,
    reportMissingMeta,
  });

  const outDir = path.dirname(path.resolve(outPath));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.resolve(outPath), sql, 'utf-8');

  const reportPath = outPath.replace(/\.sql$/i, '') + '.report.txt';
  fs.writeFileSync(
    reportPath,
    [
      `Wiersze leksykalne (po merge): ${merged.size}`,
      `Wiersze tłumaczeń: ${translations.length}`,
      `Brak metadanych CEFR/POS dla tłumaczenia (${reportMissingMeta.length}):`,
      ...reportMissingMeta.slice(0, 500),
      reportMissingMeta.length > 500 ? `… i ${String(reportMissingMeta.length - 500)} więcej` : '',
    ].join('\n'),
    'utf-8',
  );

  console.log(`OK: ${outPath}`);
  console.log(`Raport: ${reportPath}`);
  if (reportMissingMeta.length > 0) {
    console.warn(`Uwaga: ${String(reportMissingMeta.length)} tłumaczeń bez dopasowania w źródłach (szczegóły w raporcie).`);
  }
}

main();
