/**
 * Wykonuje po kolei pliki *.part*.sql (np. z splitSeedSql) przez node-pg — bez ręcznego wklejania.
 *
 * **IPv4 vs Supabase:** Na sieci **IPv4** użyj **Session pooler** (w panelu: „IPv4 compatible”, user
 * `postgres.<project-ref>`, host `aws-….pooler.supabase.com`, port zwykle **5432** — dokładnie jak w URI z panelu).
 * Na **IPv6** możesz użyć **Direct connection** (`db.<ref>.supabase.co:5432`). Albo IPv4 add-on dla direct.
 * W `.env` dopisz `?sslmode=require` (node-pg).
 *
 *   DATABASE_URL=postgresql://postgres.<project-ref>:…@aws-….pooler.supabase.com:5432/postgres?sslmode=require
 *   npm run vocabulary:seed:apply-chunks
 *
 * Opcjonalnie:
 *   --dir supabase/seeds/generated/freedict_chunks
 *   --from-part 33   — zacznij od part033.sql (pomiń 001–032), np. po przerwanym imporcie
 *
 * Alternatywnie: `DATABASE_POOLER_URL` zamiast `DATABASE_URL`, jeśli trzymasz oba warianty.
 */
import dns from 'dns';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { parseIntoClientConfig } from 'pg-connection-string';

/** Katalog główny repo (3 poziomy w górę od `scripts/vocabulary-seed/src/`). */
function getMobileProjectRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

/**
 * Wczytuje `.env` z kilku miejsc — `npm`/`tsx` czasem ma `cwd` inny niż katalog aplikacji,
 * wtedy samo `process.cwd()/.env` nie istnieje.
 */
function loadEnvFiles(): void {
  const mobileRoot = getMobileProjectRoot();
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.join(mobileRoot, '.env'),
  ];
  const uniq = [...new Set(candidates.map((p) => path.normalize(p)))];
  let loaded = 0;
  for (const envPath of uniq) {
    if (!fs.existsSync(envPath)) {
      continue;
    }
    // override: false — kolejne pliki tylko uzupełniają brakujące klucze (np. DATABASE_URL z `.env` w root).
    dotenv.config({ path: envPath, override: false });
    loaded += 1;
    console.error(`Wczytano .env: ${envPath}`);
  }
  if (loaded === 0) {
    console.error('Uwaga: nie znaleziono pliku .env w żadnej z lokalizacji:');
    for (const p of uniq) {
      console.error(`  - ${p}`);
    }
  }
}

/**
 * Jeśli w środowisku jest już `DATABASE_URL=""` (Expo/IDE/clear), `dotenv` z override:false
 * **nie nadpisuje** — wtedy plik `.env` jest ignorowany. Wymuszamy wartości z `.env` w katalogu głównym repo.
 */
function applyDatabaseUrlsFromProjectEnvFile(): void {
  const envPath = path.join(getMobileProjectRoot(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }
  const parsed = dotenv.parse(fs.readFileSync(envPath));
  const set = (key: string, value: string | undefined) => {
    const v = value?.trim();
    if (v) {
      process.env[key] = v;
    }
  };
  set('DATABASE_URL', parsed.DATABASE_URL);
  set('SUPABASE_DB_URL', parsed.SUPABASE_DB_URL);
  set('DATABASE_POOLER_URL', parsed.DATABASE_POOLER_URL);
  set('SUPABASE_POOLER_URL', parsed.SUPABASE_POOLER_URL);
  set('DATABASE_HOST', parsed.DATABASE_HOST);
  set('DATABASE_USER', parsed.DATABASE_USER);
  set('DATABASE_PASSWORD', parsed.DATABASE_PASSWORD);
  set('DATABASE_PORT', parsed.DATABASE_PORT);
  set('DATABASE_NAME', parsed.DATABASE_NAME);
}

loadEnvFiles();
applyDatabaseUrlsFromProjectEnvFile();

/** Supabase często zwraca IPv6 pierwszy; u niektórych sieci `ECONNREFUSED` na :5432 — wymuszamy IPv4. */
dns.setDefaultResultOrder('ipv4first');

function isIPv4Literal(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/**
 * Rekord A (IPv4) — kilka prób: `lookup` i `resolve4` (czasem jedno zwraca ENOTFOUND przy drugim OK).
 */
async function resolveFirstIPv4(hostname: string): Promise<string | null> {
  if (isIPv4Literal(hostname)) {
    return hostname;
  }

  try {
    const { address } = await dns.promises.lookup(hostname, { family: 4 });
    return address;
  } catch {
    // next
  }

  try {
    const addrs = await dns.promises.resolve4(hostname);
    return addrs[0] ?? null;
  } catch {
    // next
  }

  try {
    const r = await dns.promises.lookup(hostname, { all: true });
    const list = Array.isArray(r) ? r : [r];
    for (const entry of list) {
      if (entry.family === 4) {
        return entry.address;
      }
    }
  } catch {
    // next
  }

  return null;
}

/** Gdy `DATABASE_URL` ma hasło ze znakami `@ # % : ?` itd., `pg-connection-string` rzuca `Invalid URL` — wtedy użyj tych pól w `.env`. */
function buildClientConfigFromDiscreteEnv(): pg.ClientConfig | null {
  const host = process.env.DATABASE_HOST?.trim();
  const user = process.env.DATABASE_USER?.trim();
  const password = process.env.DATABASE_PASSWORD?.trim();
  if (!host || !user || !password) {
    return null;
  }
  const portRaw = process.env.DATABASE_PORT?.trim();
  const database = process.env.DATABASE_NAME?.trim() ?? 'postgres';
  const port = portRaw ? parseInt(portRaw, 10) : 5432;
  if (Number.isNaN(port)) {
    return null;
  }
  return {
    host,
    user,
    password,
    port,
    database,
    ssl: { rejectUnauthorized: false },
  };
}

/**
 * Ładuje `ClientConfig`: najpierw `DATABASE_URL` / pooler URI, przy `Invalid URL` — osobne zmienne z `.env`.
 */
function loadPgClientConfig(): pg.ClientConfig {
  const discrete = buildClientConfigFromDiscreteEnv();
  const conn =
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.DATABASE_POOLER_URL?.trim() ||
    process.env.SUPABASE_POOLER_URL?.trim();

  if (conn) {
    try {
      return parseIntoClientConfig(conn);
    } catch (e) {
      if (discrete) {
        console.error(
          'DATABASE_URL nie jest poprawnym URI (Invalid URL — często hasło ze znakami @ # % : ?). Używam DATABASE_HOST / DATABASE_USER / DATABASE_PASSWORD z .env.',
        );
        return discrete;
      }
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        [
          `Nie można sparsować connection stringa: ${msg}`,
          '',
          'Hasło w URI musi być zakodowane (encodeURIComponent) albo rozdziel konfigurację w `.env` w root repo:',
          '  DATABASE_HOST=aws-….pooler.supabase.com',
          '  DATABASE_USER=postgres.twoj_project_ref',
          '  DATABASE_PASSWORD=twoje_haslo',
          '  DATABASE_PORT=5432',
          '  DATABASE_NAME=postgres',
        ].join('\n'),
      );
    }
  }

  if (discrete) {
    console.error('Używam DATABASE_HOST / DATABASE_USER / DATABASE_PASSWORD (brak poprawnego DATABASE_URL).');
    return discrete;
  }

  throw new Error(
    'Brak DATABASE_URL (lub pooler URL) ani kompletu DATABASE_HOST + DATABASE_USER + DATABASE_PASSWORD w .env.',
  );
}

/**
 * Hasło w URI bywa obcinane / źle parsowane (znaki specjalne). Osobna zmienna z `.env` ma pierwszeństwo.
 * Logowanie do **dashboardu** Supabase ≠ hasło **Database password** (Postgres).
 */
function mergeDatabasePasswordOverride(config: pg.ClientConfig): pg.ClientConfig {
  const pw = process.env.DATABASE_PASSWORD?.trim();
  if (!pw) {
    return config;
  }
  console.error('Hasło: używam DATABASE_PASSWORD z .env (nadpisuje hasło z parsowania DATABASE_URL).');
  return { ...config, password: pw };
}

/**
 * Następnie ustawiamy `host` na adres z rekordu A (IPv4), żeby uniknąć `ECONNREFUSED` na IPv6.
 *
 * Gdy **nie ma** rekordu A, nie wracamy po cichu do nazwy hosta (bo `pg` wtedy wybiera IPv6 i pada).
 */
async function clientConfigForceIPv4(config: pg.ClientConfig): Promise<pg.ClientConfig> {
  const host = config.host;
  if (!host) {
    return { ...config, ssl: { rejectUnauthorized: false } };
  }
  if (isIPv4Literal(host)) {
    return { ...config, ssl: { rejectUnauthorized: false } };
  }
  if (host.includes(':')) {
    return { ...config, ssl: { rejectUnauthorized: false } };
  }

  /** Podmiana na surowy IPv4 psuje często auth przy Supabase Session pooler (błąd „user postgres”). Zostaw hostname; `ipv4first` wybiera A. */
  if (/\.pooler\.supabase\.com$/i.test(host)) {
    console.error(
      'Pooler: zostawiam hostname (bez podmiany na IP) — Session pooler wymaga poprawnej nazwy hosta przy TLS/auth.',
    );
    return {
      ...config,
      ssl: { rejectUnauthorized: false },
    };
  }

  const ipv4 = await resolveFirstIPv4(host);
  if (ipv4) {
    console.error(`DNS: ${host} → ${ipv4} (IPv4, omijamy IPv6 / ECONNREFUSED)`);
    return {
      ...config,
      host: ipv4,
      ssl: { rejectUnauthorized: false },
    };
  }

  throw new Error(
    [
      `Brak adresu IPv4 (rekord A) dla hosta: ${host}`,
      '',
      'Supabase często pokazuje: „Not IPv4 compatible — use Session Pooler if on an IPv4 network',
      'or purchase IPv4 add-on”.',
      '',
      '→ Na sieci IPv4: **Session pooler** z panelu — Database → Connection string → Session pooler.',
      '  User: postgres.<project-ref>  host: …pooler.supabase.com  port: jak w panelu (często 5432).',
      '  Wklej pełny URI do `DATABASE_URL` (+ ?sslmode=require).',
      '',
      '→ Albo dokup w Supabase **IPv4 add-on**, wtedy direct `db.*.supabase.co:5432` dostaje IPv4.',
    ].join('\n'),
  );
}

function getArg(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i >= 0 && argv[i + 1]) {
    return argv[i + 1];
  }
  return undefined;
}

/** Sortowanie numeryczne: part010 po part009 (string sort by to psuje). */
function listPartSqlFiles(dir: string, fromPartInclusive?: number): string[] {
  const names = fs.readdirSync(dir).filter((n) => n.endsWith('.sql') && /\.part\d+/.test(n));
  return names
    .map((name) => {
      const m = /\.part(\d+)\.sql$/i.exec(name);
      const num = m ? parseInt(m[1], 10) : 0;
      return { name, num };
    })
    .filter((x) => (fromPartInclusive === undefined ? true : x.num >= fromPartInclusive))
    .sort((a, b) => a.num - b.num)
    .map((x) => path.join(dir, x.name));
}

/** Jedna linia = jedno polecenie SQL (jak w naszym generatorze). */
async function runSqlFile(client: pg.Client, filePath: string): Promise<void> {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('--')) {
      continue;
    }
    await client.query(t);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const chunksDir = path.resolve(
    getArg(argv, '--dir') ?? path.join('supabase', 'seeds', 'generated', 'freedict_chunks'),
  );

  const fromPartRaw = getArg(argv, '--from-part');
  let fromPartInclusive: number | undefined;
  if (fromPartRaw !== undefined) {
    const n = parseInt(fromPartRaw, 10);
    if (Number.isNaN(n) || n < 1) {
      console.error('--from-part wymaga liczby ≥ 1 (np. --from-part 33)');
      process.exit(1);
    }
    fromPartInclusive = n;
  }

  let initialConfig: pg.ClientConfig;
  try {
    initialConfig = mergeDatabasePasswordOverride(loadPgClientConfig());
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    console.error('');
    console.error('Supabase → Database → Session pooler: skopiuj URI do DATABASE_URL + ?sslmode=require');
    console.error('Albo rozdziel (gdy Invalid URL przez znaki w haśle): DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, …');
    process.exit(1);
  }

  const direct =
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim();
  const poolerOnly =
    !direct &&
    (process.env.DATABASE_POOLER_URL?.trim() || process.env.SUPABASE_POOLER_URL?.trim());
  if (poolerOnly) {
    console.error('Używam DATABASE_POOLER_URL (Session pooler — OK na IPv4).');
  } else {
    const h = initialConfig.host ?? '';
    const port = initialConfig.port;
    if (/pooler\.supabase\.com/i.test(h)) {
      console.error(`Połączenie: Session pooler (${String(port ?? '?')}) — host pooler, IPv4 proxied (wg Supabase).`);
    }
  }

  const host0 = String(initialConfig.host ?? '');
  const user0 = String(initialConfig.user ?? '');
  console.error(`PostgreSQL user (z connection stringa): ${user0 || '(brak)'}`);
  if (/pooler\.supabase\.com/i.test(host0) && user0 === 'postgres') {
    console.error('');
    console.error('BŁĄD: Session pooler wymaga usera postgres.<project-ref> (np. postgres.qbvyiffqsbymiacpctza), nie samego „postgres”.');
    console.error('W DATABASE_URL musi być: postgresql://postgres.TWOJ_REF:hasło@…pooler… — skopiuj URI z panelu Supabase.');
    process.exit(1);
  }

  if (!fs.existsSync(chunksDir)) {
    console.error(`Brak katalogu: ${chunksDir}`);
    console.error('Najpierw: npm run vocabulary:seed:split-sql -- --in supabase/seeds/generated/wordly_freedict_full.sql');
    process.exit(1);
  }

  const files = listPartSqlFiles(chunksDir, fromPartInclusive);
  if (files.length === 0) {
    console.error(`Brak plików *.part*.sql w ${chunksDir}${fromPartInclusive !== undefined ? ` (od part ${String(fromPartInclusive).padStart(3, '0')})` : ''}`);
    process.exit(1);
  }
  if (fromPartInclusive !== undefined) {
    console.error(`--from-part ${String(fromPartInclusive)}: pomijam chunki przed part${String(fromPartInclusive).padStart(3, '0')}.sql (${String(files.length)} plików do wykonania).`);
  }

  const clientConfig = await clientConfigForceIPv4(initialConfig);

  const client = new pg.Client(clientConfig);

  await client.connect();

  const tableCheck = await client.query(
    `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'vocabulary_lemmas' limit 1`,
  );
  if (tableCheck.rowCount === 0) {
    console.error('');
    console.error('Brak tabeli public.vocabulary_lemmas — najpierw zastosuj migracje w tym projekcie Supabase.');
    console.error('  CLI: supabase link → supabase db push (z katalogu głównego repo)');
    console.error('  albo SQL Editor: wklej po kolei pliki z supabase/migrations/ (nazwy z datą, rosnąco).');
    await client.end();
    process.exit(1);
  }

  console.error(`Połączono. Wykonuję ${String(files.length)} plików…`);

  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const short = path.basename(f);
      console.error(`[${String(i + 1)}/${String(files.length)}] ${short}`);
      await runSqlFile(client, f);
    }
  } finally {
    await client.end();
  }

  console.error('Gotowe.');
}

void main().catch((e: unknown) => {
  console.error(e);
  const err = e as { code?: string; message?: string };
  if (err.code === '28P01' || /password authentication failed/i.test(String(err.message))) {
    console.error('');
    console.error('Hasło (28P01):');
    console.error('  • Logowanie do **supabase.com (dashboard)** to NIE to samo co **Database password** w Project Settings → Database.');
    console.error('  • Ustaw w .env drugą linię: DATABASE_PASSWORD=… (hasło z „Reset database password”) — nadpisuje hasło w URI.');
    console.error('  • Albo usuń hasło z DATABASE_URL i zostaw tylko user@host + DATABASE_PASSWORD.');
    console.error('  • Komunikat „user postgres” przy poolerze bywa mylący — sprawdź DATABASE_PASSWORD i reset hasła w panelu.');
  }
  process.exit(1);
});
