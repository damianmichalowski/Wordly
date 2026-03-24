/**
 * Dzieli duży plik SQL z seeda (begin … insert … commit) na mniejsze pliki,
 * żeby zmieścić się w limicie Supabase SQL Editor.
 *
 * Użycie:
 *   npx tsx scripts/vocabulary-seed/src/splitSeedSql.ts supabase/seeds/generated/wordly_freedict_full.sql
 *   npx tsx scripts/vocabulary-seed/src/splitSeedSql.ts --in file.sql --out-dir supabase/seeds/generated/chunks --chunk 400
 */
import fs from 'fs';
import path from 'path';

function getArg(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i >= 0 && argv[i + 1]) {
    return argv[i + 1];
  }
  return undefined;
}

function main(): void {
  const argv = process.argv.slice(2);
  const inputPath =
    getArg(argv, '--in') ?? argv.find((a) => !a.startsWith('-') && a.endsWith('.sql'));
  const outDir =
    getArg(argv, '--out-dir') ??
    path.join('supabase', 'seeds', 'generated', 'freedict_chunks');
  /** Domyślnie 800 INSERT-ów na plik (~200–400 KB) — poniżej limitu SQL Editor. */
  const chunkSize = parseInt(getArg(argv, '--chunk') ?? '800', 10);

  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error('Podaj plik wejściowy: npx tsx ... [--in] path/to.sql');
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(inputPath), 'utf-8');
  const lines = raw.split(/\r?\n/);

  let i = 0;
  const header: string[] = [];
  while (i < lines.length && lines[i].startsWith('--')) {
    header.push(lines[i]);
    i++;
  }
  while (i < lines.length && lines[i].trim() === '') {
    i++;
  }

  const beginLine = lines[i]?.trim().toLowerCase();
  if (beginLine !== 'begin;') {
    console.error(`Oczekiwano begin; (linia ${String(i + 1)}), jest: ${lines[i] ?? '(koniec)'}`);
    process.exit(1);
  }
  i++;

  const insertLines: string[] = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t.toLowerCase() === 'commit;') {
      break;
    }
    if (t && t.toLowerCase().startsWith('insert into')) {
      insertLines.push(line);
    }
  }

  const lemmas = insertLines.filter((l) => l.includes('vocabulary_lemmas'));
  const senses = insertLines.filter((l) => l.includes('vocabulary_senses'));

  if (lemmas.length + senses.length !== insertLines.length) {
    console.error('Nie rozpoznano części insertów (oczekiwano tylko lemmas/senses).');
    process.exit(1);
  }

  type Chunk = { label: string; lines: string[] };
  const chunks: Chunk[] = [];

  function pushBatches(label: string, rows: string[]): void {
    for (let start = 0; start < rows.length; start += chunkSize) {
      const part = rows.slice(start, start + chunkSize);
      chunks.push({
        label: `${label} ${String(start + 1)}–${String(start + part.length)} / ${String(rows.length)}`,
        lines: part,
      });
    }
  }

  pushBatches('vocabulary_lemmas', lemmas);
  pushBatches('vocabulary_senses', senses);

  fs.mkdirSync(outDir, { recursive: true });
  const base = path.basename(inputPath, '.sql');

  /** Stare partXXX.sql z poprzedniego podziału (np. 112 plików) — usuwamy, żeby nie mieszać z nową serią. */
  const existing = fs.existsSync(outDir) ? fs.readdirSync(outDir) : [];
  const partRe = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.part\\d+\\.sql$`, 'i');
  for (const name of existing) {
    if (partRe.test(name)) {
      fs.unlinkSync(path.join(outDir, name));
      console.error(`Usunięto stary chunk: ${name}`);
    }
  }

  chunks.forEach((chunk, idx) => {
    const num = String(idx + 1).padStart(3, '0');
    const name = `${base}.part${num}.sql`;
    const outPath = path.join(outDir, name);
    const body = [
      ...header,
      '',
      `-- Chunk ${String(idx + 1)}/${String(chunks.length)}: ${chunk.label}`,
      '',
      'begin;',
      ...chunk.lines,
      'commit;',
      '',
    ].join('\n');
    fs.writeFileSync(outPath, body, 'utf-8');
    console.error(`Zapisano ${outPath} (${String(chunk.lines.length)} insertów)`);
  });

  console.error(`\nGotowe: ${String(chunks.length)} plików w ${path.resolve(outDir)}`);
  console.error('Uruchamiaj po kolei part001, part002, … w SQL Editor.');
}

main();
