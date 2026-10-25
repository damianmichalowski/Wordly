import { CefrLevel, FinalBatch, PartOfSpeech } from "../types";

export type DbClient = {
  enabled: boolean;
  request<T>(path: string, init?: RequestInit): Promise<T>;
};

function getEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, key };
}

export function createDbClient(): DbClient {
  const { url, key } = getEnv();
  if (!url || !key) {
    return {
      enabled: false,
      async request() {
        throw new Error("Supabase env not configured");
      },
    };
  }

  const base = `${url.replace(/\/$/, "")}/rest/v1`;

  return {
    enabled: true,
    async request<T>(requestPath: string, init: RequestInit = {}): Promise<T> {
      const response = await fetch(`${base}${requestPath}`, {
        ...init,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
          ...(init.headers ?? {}),
        },
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Supabase request failed ${response.status}: ${body}`);
      }
      const text = await response.text();
      return text ? (JSON.parse(text) as T) : ([] as T);
    },
  };
}

function enc(value: string) {
  return encodeURIComponent(value);
}

type IdRow = { id: string; code?: string; name?: string };
type WordRow = { id: string; lemma: string };
type WordCategoryRow = { word_id: string; category_id?: string };
type CategoryRow = { id: string; code: string; name?: string; is_active?: boolean };

const DB_PAGE_SIZE = 1000;
const DB_MAX_PAGES = 50;

function appendQuery(path: string, params: Record<string, string | number>) {
  const joiner = path.includes("?") ? "&" : "?";
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${enc(String(value))}`)
    .join("&");
  return `${path}${joiner}${query}`;
}

async function requestPaged<T>(db: DbClient, basePath: string, options: { pageSize?: number; maxPages?: number } = {}): Promise<T[]> {
  const pageSize = options.pageSize ?? DB_PAGE_SIZE;
  const maxPages = options.maxPages ?? DB_MAX_PAGES;
  const all: T[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize;
    const rows = await db.request<T[]>(appendQuery(basePath, { limit: pageSize, offset }));
    all.push(...rows);

    if (rows.length < pageSize) return all;
  }

  throw new Error(`DB pagination limit reached for ${basePath}. Increase DB_MAX_PAGES if the dataset is larger than ${pageSize * maxPages} rows.`);
}

async function loadActiveWordRowsForLanguage(db: DbClient, languageId: string): Promise<WordRow[]> {
  return requestPaged<WordRow>(
    db,
    `/words?target_language_id=eq.${languageId}&is_active=eq.true&select=id,lemma&order=lemma.asc`
  );
}

async function loadActiveWordRowsForLevel(db: DbClient, languageId: string, cefrId: string): Promise<WordRow[]> {
  return requestPaged<WordRow>(
    db,
    `/words?target_language_id=eq.${languageId}&cefr_level_id=eq.${cefrId}&is_active=eq.true&select=id,lemma&order=lemma.asc`
  );
}

async function loadWordCategoryRowsForCategory(db: DbClient, categoryId: string): Promise<WordCategoryRow[]> {
  return requestPaged<WordCategoryRow>(
    db,
    `/word_category?category_id=eq.${categoryId}&select=word_id,category_id&order=word_id.asc`
  );
}

async function loadActiveCategoryRows(db: DbClient, categoryCodes?: string[]): Promise<CategoryRow[]> {
  if (categoryCodes && categoryCodes.length > 0) {
    const result: CategoryRow[] = [];
    for (const code of categoryCodes) {
      const rows = await db.request<CategoryRow[]>(`/category?code=eq.${enc(code)}&is_active=eq.true&select=id,code,name,is_active&limit=1`);
      if (rows[0]) result.push(rows[0]);
    }
    return result;
  }

  return requestPaged<CategoryRow>(
    db,
    `/category?is_active=eq.true&select=id,code,name,is_active&order=code.asc`
  );
}

export async function findLanguageId(db: DbClient, codeOrName: string): Promise<string | null> {
  if (!db.enabled) return null;
  const codeRows = await db.request<IdRow[]>(`/language?code=eq.${enc(codeOrName)}&select=id,code,name&limit=1`);
  if (codeRows[0]?.id) return codeRows[0].id;
  const nameRows = await db.request<IdRow[]>(`/language?name=eq.${enc(codeOrName)}&select=id,code,name&limit=1`);
  return nameRows[0]?.id ?? null;
}

export async function findCefrId(db: DbClient, level: CefrLevel): Promise<string | null> {
  const rows = await db.request<IdRow[]>(`/cefr_level?code=eq.${enc(level)}&select=id,code&limit=1`);
  return rows[0]?.id ?? null;
}

export async function findPartOfSpeechId(db: DbClient, pos: PartOfSpeech): Promise<string | null> {
  const rows = await db.request<IdRow[]>(`/part_of_speech?code=eq.${enc(pos)}&select=id,code&limit=1`);
  return rows[0]?.id ?? null;
}

export async function findCategoryId(db: DbClient, categoryCode: string): Promise<string | null> {
  const rows = await db.request<IdRow[]>(`/category?code=eq.${enc(categoryCode)}&select=id,code,name&limit=1`);
  return rows[0]?.id ?? null;
}

async function loadCategoryAttachedWordRows(db: DbClient, languageId: string, categoryCode: string): Promise<WordRow[]> {
  const categoryId = await findCategoryId(db, categoryCode);
  if (!categoryId) return [];

  const activeWords = await loadActiveWordRowsForLanguage(db, languageId);
  const byId = new Map(activeWords.map((word) => [word.id, word]));
  const categoryLinks = await loadWordCategoryRowsForCategory(db, categoryId);

  return categoryLinks
    .map((link) => byId.get(link.word_id))
    .filter((word): word is WordRow => Boolean(word));
}

export async function loadExistingLemmas(params: {
  mode: "cefr" | "category";
  targetLanguageCode: string;
  level?: CefrLevel;
  category?: string;
}): Promise<string[]> {
  const db = createDbClient();
  if (!db.enabled) return [];

  const languageId = await findLanguageId(db, params.targetLanguageCode);
  if (!languageId) return [];

  if (params.mode === "cefr") {
    // CEFR source of truth: a lemma belongs to exactly one CEFR level in the DB.
    // Therefore CEFR generation excludes all existing lemmas for the target language.
    const rows = await loadActiveWordRowsForLanguage(db, languageId);
    return rows.map((r) => r.lemma.toLowerCase());
  }

  // Category source of truth: a lemma may belong to many categories.
  // Therefore category generation excludes only lemmas already attached to THIS category.
  // Existing DB lemmas without this category remain valid candidates and will be attached on import.
  if (!params.category) return [];
  const rows = await loadCategoryAttachedWordRows(db, languageId, params.category);
  return rows.map((r) => r.lemma.toLowerCase());
}

export async function getCefrCoverage(targetLanguageCode: string, levels: CefrLevel[]): Promise<Record<CefrLevel, number>> {
  const result = Object.fromEntries(levels.map((level) => [level, 0])) as Record<CefrLevel, number>;
  const db = createDbClient();
  if (!db.enabled) return result;

  const languageId = await findLanguageId(db, targetLanguageCode);
  if (!languageId) return result;

  for (const level of levels) {
    const cefrId = await findCefrId(db, level);
    if (!cefrId) continue;

    const wordRows = await loadActiveWordRowsForLevel(db, languageId, cefrId);
    result[level] = wordRows.length;
  }

  return result;
}

export async function getCategoryCoverage(targetLanguageCode: string, categoryCodes?: string[]): Promise<Record<string, number>> {
  const db = createDbClient();
  const requestedCodes = (categoryCodes ?? []).map((code) => code.trim()).filter(Boolean);
  const result: Record<string, number> = Object.fromEntries(requestedCodes.map((code) => [code, 0]));
  if (!db.enabled) return result;

  const languageId = await findLanguageId(db, targetLanguageCode);
  if (!languageId) return result;

  const activeWords = await loadActiveWordRowsForLanguage(db, languageId);
  const activeWordIds = new Set(activeWords.map((word) => word.id));
  const categories = await loadActiveCategoryRows(db, requestedCodes.length > 0 ? requestedCodes : undefined);

  for (const category of categories) {
    const links = await loadWordCategoryRowsForCategory(db, category.id);
    result[category.code] = links.filter((link) => activeWordIds.has(link.word_id)).length;
  }

  return result;
}

export async function getNextBatchNumberFromFiles(prefix: string, fileNames: string[]): Promise<number> {
  const re = new RegExp(`^${prefix.toLowerCase()}_(\\d{3})\\.json$`, "i");
  const numbers = fileNames
    .map((name) => name.match(re)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number);
  return numbers.length ? Math.max(...numbers) + 1 : 1;
}

export type ImportResult = {
  attempted: boolean;
  dry_run: boolean;
  inserted_words: number;
  skipped_existing: number;
  inserted_senses: number;
  inserted_examples: number;
  attached_categories: number;
  inserted_lemmas: string[];
  skipped_existing_lemmas: string[];
  attached_category_lemmas: string[];
  errors: string[];
};

export async function importBatchToSupabase(batch: FinalBatch, options: { dryRun: boolean; targetLanguageCode: string; sourceLanguageCode: string }): Promise<ImportResult> {
  const result: ImportResult = {
    attempted: true,
    dry_run: options.dryRun,
    inserted_words: 0,
    skipped_existing: 0,
    inserted_senses: 0,
    inserted_examples: 0,
    attached_categories: 0,
    inserted_lemmas: [],
    skipped_existing_lemmas: [],
    attached_category_lemmas: [],
    errors: [],
  };

  const db = createDbClient();
  if (!db.enabled) {
    result.errors.push("Supabase env not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    return result;
  }

  const targetLanguageId = await findLanguageId(db, options.targetLanguageCode);
  const sourceLanguageId = await findLanguageId(db, options.sourceLanguageCode);
  if (!targetLanguageId || !sourceLanguageId) {
    result.errors.push("Target/source language not found in DB.");
    return result;
  }

  const categoryId = batch.category ? await findCategoryId(db, batch.category) : null;
  if (batch.category && !categoryId) {
    result.errors.push(`Category not found: ${batch.category}`);
    return result;
  }

  const posIds = new Map<PartOfSpeech, string>();
  for (const pos of ["noun", "verb", "adjective", "adverb", "preposition", "phrase", "other"] as PartOfSpeech[]) {
    const id = await findPartOfSpeechId(db, pos).catch(() => null);
    if (id) posIds.set(pos, id);
  }

  for (const entry of batch.entries) {
    try {
      const existing = await db.request<WordRow[]>(`/words?target_language_id=eq.${targetLanguageId}&lemma=eq.${enc(entry.lemma)}&select=id,lemma&limit=1`);
      const existedBefore = Boolean(existing[0]?.id);
      let wordId = existing[0]?.id;

      if (wordId) {
        result.skipped_existing++;
        result.skipped_existing_lemmas.push(entry.lemma);
      } else {
        const cefrId = await findCefrId(db, entry.level);
        if (!cefrId) throw new Error(`CEFR level missing in DB: ${entry.level}`);
        if (!options.dryRun) {
          const inserted = await db.request<WordRow[]>(`/words`, {
            method: "POST",
            body: JSON.stringify({
              target_language_id: targetLanguageId,
              lemma: entry.lemma,
              cefr_level_id: cefrId,
              ipa: entry.ipa,
              is_active: true,
            }),
          });
          wordId = inserted[0]?.id;
        } else {
          wordId = `dry-${entry.lemma}`;
        }
        result.inserted_words++;
        result.inserted_lemmas.push(entry.lemma);
      }

      if (categoryId) {
        if (wordId && !wordId.startsWith("dry-")) {
          const existingCat = await db.request<{ id: string }[]>(`/word_category?word_id=eq.${wordId}&category_id=eq.${categoryId}&select=id&limit=1`);
          if (!existingCat[0]) {
            if (!options.dryRun) {
              await db.request(`/word_category`, { method: "POST", body: JSON.stringify({ word_id: wordId, category_id: categoryId }) });
            }
            result.attached_categories++;
            result.attached_category_lemmas.push(entry.lemma);
          }
        } else if (options.dryRun) {
          // Newly inserted dry-run words would also receive the category in a live import.
          result.attached_categories++;
          result.attached_category_lemmas.push(entry.lemma);
        }
      }

      // Existing lemmas keep their current senses. Category import attaches metadata only.
      if (existedBefore) continue;

      for (const sense of entry.senses) {
        const posId = posIds.get(sense.part_of_speech);
        if (!posId) throw new Error(`Part of speech not found in DB: ${sense.part_of_speech}`);

        let senseId = `dry-sense-${entry.lemma}-${sense.sense_order}`;
        if (!options.dryRun && wordId && !wordId.startsWith("dry-")) {
          const insertedSense = await db.request<{ id: string }[]>(`/sense`, {
            method: "POST",
            body: JSON.stringify({ word_id: wordId, part_of_speech_id: posId, sense_order: sense.sense_order }),
          });
          senseId = insertedSense[0]?.id;
        }
        result.inserted_senses++;

        let translationId = `dry-translation-${entry.lemma}-${sense.sense_order}`;
        if (!options.dryRun && senseId && !senseId.startsWith("dry-")) {
          const insertedTranslation = await db.request<{ id: string }[]>(`/sense_translation`, {
            method: "POST",
            body: JSON.stringify({ sense_id: senseId, native_language_id: sourceLanguageId, translation: sense.translation.text }),
          });
          translationId = insertedTranslation[0]?.id;
        }

        for (const example of sense.translation.examples) {
          if (!options.dryRun && translationId && !translationId.startsWith("dry-")) {
            await db.request(`/translation_example`, {
              method: "POST",
              body: JSON.stringify({ sense_translation_id: translationId, example_text: example.text, example_order: example.example_order }),
            });
          }
          result.inserted_examples++;
        }
      }
    } catch (error) {
      result.errors.push(`${entry.lemma}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return result;
}
