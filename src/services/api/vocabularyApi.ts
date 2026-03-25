import { toVisibleCardWordForTranslation } from "@/src/features/dailyWord/visibleCardTranslations";
import { getCatalogLanguagePair } from "@/src/domain/vocabulary/catalogLanguagePair";
import { getSupabaseClient, hasSupabaseEnv } from "@/src/lib/supabase/client";
import { traceSupabase } from "@/src/utils/supabaseTrace";
import type { CefrLevel } from "@/src/types/cefr";
import type { Database } from "@/src/types/database";
import type { LanguageCode } from "@/src/types/language";
import type { UserProfile } from "@/src/types/profile";
import type { VocabularyWord } from "@/src/types/words";

export type VocabularySenseDisplayRow =
  Database["public"]["Views"]["vocabulary_sense_display"]["Row"];

export type FetchVocabularySensesParams = {
  sourceLanguageCode: LanguageCode;
  targetLanguageCode: LanguageCode;
  cefrLevel?: CefrLevel;
  /** Opcjonalny limit (np. przy szerokim zapytaniu bez CEFR). */
  limit?: number;
};

/**
 * Supabase (PostgREST) bez jawnego `limit` zwykle zwraca max **~1000** wierszy; stąd mylące
 * „Pozostało x/1000” w Daily. Daily Word ma świadomie pobierać większą pulę kandydatów.
 */
const DAILY_WORD_CANDIDATE_LIMIT = 8000;

/**
 * Explicit columns for list queries — avoids huge PostgREST payloads vs `select("*")`.
 * Matches `Database["public"]["Views"]["vocabulary_sense_display"]["Row"]`.
 */
export const VOCABULARY_SENSE_DISPLAY_COLUMNS =
  "sense_id, lemma_id, source_language_code, target_language_code, lemma_text, gloss_text, cefr_level, part_of_speech, pronunciation_text, audio_url, sense_index" as const;

function dedupeWordsBySenseId(words: VocabularyWord[]): VocabularyWord[] {
  const seen = new Set<string>();
  const out: VocabularyWord[] = [];
  for (const w of words) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    out.push(w);
  }
  return out;
}

function mergeExampleIntoWord(
  w: VocabularyWord,
  ex: { source: string; target: string | null } | undefined,
): VocabularyWord {
  if (!ex) {
    return w;
  }
  return {
    ...w,
    exampleSource: ex.source,
    exampleTarget: ex.target ?? "",
  };
}

const inFlightEnrichHomeDisplay = new Map<string, Promise<VocabularyWord[]>>();

function enrichHomeDisplayKey(profile: UserProfile, senseIds: string[]): string {
  return `${profile.userId}|${[...new Set(senseIds)].sort().join(',')}`;
}

async function enrichVocabularyWordsForHomeDisplayUncached(
  profile: UserProfile,
  unique: VocabularyWord[],
): Promise<VocabularyWord[]> {
  const needExamples = unique.filter((w) => !w.exampleSource?.trim());
  const examples =
    needExamples.length > 0
      ? await fetchFirstExamplesBySenseIds(needExamples.map((w) => w.id))
      : new Map<string, { source: string; target: string | null }>();
  const withExamples = unique.map((w) =>
    w.exampleSource?.trim()
      ? w
      : mergeExampleIntoWord(w, examples.get(w.id)),
  );
  const withLemmaLines = await attachLemmaGlossDisplayLines(withExamples, profile);
  return withLemmaLines.map(toVisibleCardWordForTranslation);
}

/**
 * Fetches first examples + optional multi-gloss lines only for words shown on Home / prefetch.
 * Avoids N× example queries for the entire candidate bucket (major latency win).
 * Dedupes concurrent calls with the same sense-id set; skips example fetch for rows that already have `exampleSource`.
 */
export async function enrichVocabularyWordsForHomeDisplay(
  profile: UserProfile,
  words: VocabularyWord[],
): Promise<VocabularyWord[]> {
  const unique = dedupeWordsBySenseId(words);
  if (unique.length === 0) {
    return [];
  }
  const key = enrichHomeDisplayKey(
    profile,
    unique.map((w) => w.id),
  );
  const existing = inFlightEnrichHomeDisplay.get(key);
  if (existing) {
    return existing;
  }
  const p = enrichVocabularyWordsForHomeDisplayUncached(profile, unique).finally(
    () => {
      inFlightEnrichHomeDisplay.delete(key);
    },
  );
  inFlightEnrichHomeDisplay.set(key, p);
  return p;
}

export type DailySnapshotForEnrichment = {
  activeWord: VocabularyWord | null;
  prefetch?: {
    knownQueue: VocabularyWord[];
  };
};

/** Enrich only the visible / prefetched words (not the full candidate list). */
export async function enrichDailySnapshotForDisplay<T extends DailySnapshotForEnrichment>(
  profile: UserProfile,
  snapshot: T,
): Promise<T> {
  const toEnrich: VocabularyWord[] = [];
  if (snapshot.activeWord) {
    toEnrich.push(snapshot.activeWord);
  }
  for (const w of snapshot.prefetch?.knownQueue ?? []) {
    toEnrich.push(w);
  }
  const unique = dedupeWordsBySenseId(toEnrich);
  if (unique.length === 0) {
    return snapshot;
  }
  const enrichedList = await enrichVocabularyWordsForHomeDisplay(
    profile,
    unique,
  );
  const map = new Map(enrichedList.map((w) => [w.id, w]));

  const prefetch = snapshot.prefetch;
  return {
    ...snapshot,
    activeWord: snapshot.activeWord
      ? map.get(snapshot.activeWord.id) ?? snapshot.activeWord
      : null,
    prefetch: prefetch
      ? {
          knownQueue: prefetch.knownQueue.map(
            (w) => map.get(w.id) ?? w,
          ),
        }
      : snapshot.prefetch,
  };
}

/**
 * Reads normalized lemma + sense rows from `vocabulary_sense_display`.
 * Examples: query `vocabulary_examples` separately by `sense_id`.
 */
export async function fetchVocabularySenseDisplay(
  params: FetchVocabularySensesParams,
): Promise<VocabularySenseDisplayRow[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const cefrLabel = params.cefrLevel ?? "all_cefr";
  const { data, error } = await traceSupabase(
    `vocabulary_sense_display.list (cefr=${cefrLabel}, limit=${params.limit ?? "default"})`,
    async () => {
      const supabase = getSupabaseClient();
      let q = supabase
        .from("vocabulary_sense_display")
        .select(VOCABULARY_SENSE_DISPLAY_COLUMNS)
        .eq("source_language_code", params.sourceLanguageCode)
        .eq("target_language_code", params.targetLanguageCode);

      if (params.cefrLevel) {
        q = q.eq("cefr_level", params.cefrLevel);
      }

      q = q.order("sense_id", { ascending: true });
      if (params.limit != null && params.limit > 0) {
        q = q.limit(params.limit);
      }

      return q;
    },
  );

  if (error) {
    return [];
  }

  return (data ?? []) as VocabularySenseDisplayRow[];
}

function chunkIds(ids: string[], chunkSize: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    out.push(ids.slice(i, i + chunkSize));
  }
  return out;
}

function dedupeGlossesPreserveOrder(glosses: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of glosses) {
    if (seen.has(g)) continue;
    seen.add(g);
    out.push(g);
  }
  return out;
}

const inflightLemmaGlosses = new Map<string, Promise<Map<string, string[]>>>();

function lemmaGlossesKey(profile: UserProfile, lemmaIds: string[]): string {
  return `${profile.userId}|${[...new Set(lemmaIds)].sort().join(',')}`;
}

/**
 * Wszystkie `gloss_text` dla lematów (para języków z profilu), kolejność jak w szczegółach:
 * `part_of_speech`, potem `sense_index`.
 */
async function fetchLemmaGlossesOrderedByLemmaUncached(
  profile: UserProfile,
  lemmaIds: string[],
): Promise<Map<string, string[]>> {
  if (!lemmaIds.length || !hasSupabaseEnv()) {
    return new Map();
  }
  const { lemmaLanguageCode, glossLanguageCode } =
    getCatalogLanguagePair(profile);
  const unique = [...new Set(lemmaIds)];

  type Row = {
    lemma_id: string;
    gloss_text: string;
    part_of_speech: string;
    sense_index: number;
  };

  return traceSupabase(
    `vocabulary_sense_display.lemma_glosses (${unique.length} lemmas, batched)`,
    async () => {
      const out = new Map<string, string[]>();
      const supabase = getSupabaseClient();
      for (const batch of chunkIds(unique, 200)) {
        const { data, error } = await supabase
          .from("vocabulary_sense_display")
          .select("lemma_id, gloss_text, part_of_speech, sense_index")
          .in("lemma_id", batch)
          .eq("source_language_code", lemmaLanguageCode)
          .eq("target_language_code", glossLanguageCode);

        if (error) {
          continue;
        }

        const byLemma = new Map<string, Row[]>();
        for (const row of (data ?? []) as Row[]) {
          const list = byLemma.get(row.lemma_id) ?? [];
          list.push(row);
          byLemma.set(row.lemma_id, list);
        }
        for (const [lemmaId, list] of byLemma) {
          const ordered = [...list].sort((a, b) => {
            const c = a.part_of_speech.localeCompare(b.part_of_speech);
            if (c !== 0) return c;
            return a.sense_index - b.sense_index;
          });
          const glosses = dedupeGlossesPreserveOrder(
            ordered.map((r) => r.gloss_text.trim()).filter(Boolean),
          );
          if (glosses.length > 0) {
            out.set(lemmaId, glosses);
          }
        }
      }
      return out;
    },
  );
}

async function fetchLemmaGlossesOrderedByLemma(
  profile: UserProfile,
  lemmaIds: string[],
): Promise<Map<string, string[]>> {
  if (!lemmaIds.length || !hasSupabaseEnv()) {
    return new Map();
  }
  const unique = [...new Set(lemmaIds)];
  const key = lemmaGlossesKey(profile, unique);
  const existing = inflightLemmaGlosses.get(key);
  if (existing) {
    return existing;
  }
  const p = fetchLemmaGlossesOrderedByLemmaUncached(profile, unique).finally(
    () => {
      inflightLemmaGlosses.delete(key);
    },
  );
  inflightLemmaGlosses.set(key, p);
  return p;
}

async function attachLemmaGlossDisplayLines(
  words: VocabularyWord[],
  profile: UserProfile,
): Promise<VocabularyWord[]> {
  const lemmaIds = words
    .map((w) => w.lemmaId)
    .filter((id): id is string => Boolean(id));
  if (lemmaIds.length === 0) {
    return words;
  }
  const map = await fetchLemmaGlossesOrderedByLemma(profile, lemmaIds);
  return words.map((w) => {
    if (!w.lemmaId) return w;
    const glosses = map.get(w.lemmaId);
    if (!glosses || glosses.length <= 1) return w;
    return { ...w, targetGlossParts: glosses };
  });
}

export function mapSenseDisplayRowToVocabularyWord(
  row: VocabularySenseDisplayRow,
  example?: { source: string; target: string | null },
): VocabularyWord {
  return {
    id: row.sense_id,
    sourceLanguageCode: row.source_language_code as LanguageCode,
    targetLanguageCode: row.target_language_code as LanguageCode,
    sourceText: row.lemma_text,
    targetText: row.gloss_text,
    exampleSource: example?.source ?? "",
    exampleTarget: example?.target ?? "",
    cefrLevel: row.cefr_level as CefrLevel,
    partOfSpeech: row.part_of_speech,
    lemmaId: row.lemma_id,
    pronunciationText: row.pronunciation_text ?? undefined,
    audioUrl: row.audio_url,
  };
}

const inflightAllExamplesBySenseIds = new Map<
  string,
  Promise<Map<string, { source: string; target: string | null }[]>>
>();
const completedAllExamplesByKey = new Map<
  string,
  Map<string, { source: string; target: string | null }[]>
>();
const MAX_EXAMPLES_SESSION_CACHE = 48;

function allExamplesBySenseIdsKey(senseIds: string[]): string {
  return [...new Set(senseIds)].sort().join(',');
}

async function fetchAllExamplesBySenseIdsUncached(
  unique: string[],
): Promise<Map<string, { source: string; target: string | null }[]>> {
  return traceSupabase(
    `vocabulary_examples.by_sense_ids (${unique.length} ids, batched)`,
    async () => {
      const map = new Map<string, { source: string; target: string | null }[]>();
      const supabase = getSupabaseClient();
      for (const batch of chunkIds(unique, 200)) {
        const { data, error } = await supabase
          .from("vocabulary_examples")
          .select("sense_id, example_source_text, example_target_text, sort_order")
          .in("sense_id", batch)
          .order("sort_order", { ascending: true });

        if (error) {
          continue;
        }

        for (const row of data ?? []) {
          const list = map.get(row.sense_id) ?? [];
          list.push({
            source: row.example_source_text,
            target: row.example_target_text,
          });
          map.set(row.sense_id, list);
        }
      }
      return map;
    },
  );
}

/**
 * Wszystkie przykłady (wg `sort_order`) dla każdego `sense_id`.
 * In-flight + session memo for identical sense-id sets (dedupes parallel home / prefetch enrichment).
 */
export async function fetchAllExamplesBySenseIds(
  senseIds: string[],
): Promise<Map<string, { source: string; target: string | null }[]>> {
  if (!senseIds.length || !hasSupabaseEnv()) {
    return new Map();
  }

  const unique = [...new Set(senseIds)];
  const key = allExamplesBySenseIdsKey(unique);

  const memo = completedAllExamplesByKey.get(key);
  if (memo) {
    return new Map(memo);
  }

  const inflight = inflightAllExamplesBySenseIds.get(key);
  if (inflight) {
    return inflight;
  }

  const p = fetchAllExamplesBySenseIdsUncached(unique)
    .then((map) => {
      completedAllExamplesByKey.set(key, new Map(map));
      while (completedAllExamplesByKey.size > MAX_EXAMPLES_SESSION_CACHE) {
        const first = completedAllExamplesByKey.keys().next().value;
        if (first === undefined) {
          break;
        }
        completedAllExamplesByKey.delete(first);
      }
      return map;
    })
    .finally(() => {
      inflightAllExamplesBySenseIds.delete(key);
    });

  inflightAllExamplesBySenseIds.set(key, p);
  return p;
}

/**
 * Pierwszy przykład (wg `sort_order`) dla każdego `sense_id`.
 */
export async function fetchFirstExamplesBySenseIds(
  senseIds: string[],
): Promise<Map<string, { source: string; target: string | null }>> {
  const all = await fetchAllExamplesBySenseIds(senseIds);
  const map = new Map<string, { source: string; target: string | null }>();
  for (const [id, list] of all) {
    const first = list[0];
    if (first) {
      map.set(id, first);
    }
  }
  return map;
}

export type WordDetailSenseBlock = {
  senseId: string;
  partOfSpeech: string;
  glossText: string;
  cefrLevel: CefrLevel;
  examples: { source: string; target: string | null }[];
};

export type WordDetailPosGroup = {
  partOfSpeech: string;
  senses: WordDetailSenseBlock[];
};

export type WordDetailBundle = {
  lemmaText: string;
  lemmaId: string;
  sourceLanguageCode: LanguageCode;
  targetLanguageCode: LanguageCode;
  pronunciationText?: string;
  audioUrl?: string | null;
  /** Sensy pogrupowane po `part_of_speech` (np. noun, verb). */
  groups: WordDetailPosGroup[];
};

/**
 * Szczegóły hasła: wszystkie sensy dla `lemma_id` (ta sama para języków z profilu)
 * + wszystkie przykłady. Punkt wejścia: dowolne `sense_id` (np. z Daily / listy).
 */
export async function fetchWordDetailBundleForSense(
  profile: UserProfile,
  senseId: string,
): Promise<WordDetailBundle | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const { lemmaLanguageCode, glossLanguageCode } =
    getCatalogLanguagePair(profile);

  const { data: anchor, error: anchorErr } = await traceSupabase(
    "vocabulary_sense_display.word_detail_anchor",
    async () => {
      const supabase = getSupabaseClient();
      return supabase
        .from("vocabulary_sense_display")
        .select(VOCABULARY_SENSE_DISPLAY_COLUMNS)
        .eq("sense_id", senseId)
        .eq("source_language_code", lemmaLanguageCode)
        .eq("target_language_code", glossLanguageCode)
        .maybeSingle();
    },
  );

  if (anchorErr) {
    return null;
  }

  const anchorRow = anchor as VocabularySenseDisplayRow | null;
  if (!anchorRow) {
    return null;
  }

  const { data: senseRows, error: sensesErr } = await traceSupabase(
    "vocabulary_sense_display.word_detail_senses_by_lemma",
    async () => {
      const supabase = getSupabaseClient();
      return supabase
        .from("vocabulary_sense_display")
        .select(VOCABULARY_SENSE_DISPLAY_COLUMNS)
        .eq("lemma_id", anchorRow.lemma_id)
        .eq("source_language_code", lemmaLanguageCode)
        .eq("target_language_code", glossLanguageCode)
        .order("part_of_speech", { ascending: true })
        .order("sense_index", { ascending: true });
    },
  );

  if (sensesErr) {
    return null;
  }

  const rows = (senseRows ?? []) as VocabularySenseDisplayRow[];
  if (rows.length === 0) {
    return null;
  }

  const ids = rows.map((r) => r.sense_id);
  const examplesBySense = await fetchAllExamplesBySenseIds(ids);

  const groupMap = new Map<string, WordDetailSenseBlock[]>();
  for (const row of rows) {
    const pos = row.part_of_speech || "other";
    const block: WordDetailSenseBlock = {
      senseId: row.sense_id,
      partOfSpeech: pos,
      glossText: row.gloss_text,
      cefrLevel: row.cefr_level as CefrLevel,
      examples: examplesBySense.get(row.sense_id) ?? [],
    };
    const list = groupMap.get(pos) ?? [];
    list.push(block);
    groupMap.set(pos, list);
  }

  /** Stabilna kolejność grup: zgodnie z pierwszym wystąpieniem w `rows`. */
  const groupOrder: string[] = [];
  for (const row of rows) {
    const pos = row.part_of_speech || "other";
    if (!groupOrder.includes(pos)) {
      groupOrder.push(pos);
    }
  }

  const groups: WordDetailPosGroup[] = groupOrder.map((pos) => ({
    partOfSpeech: pos,
    senses: groupMap.get(pos) ?? [],
  }));

  const first = rows[0];
  return {
    lemmaText: first.lemma_text,
    lemmaId: first.lemma_id,
    sourceLanguageCode: first.source_language_code as LanguageCode,
    targetLanguageCode: first.target_language_code as LanguageCode,
    pronunciationText: first.pronunciation_text ?? undefined,
    audioUrl: first.audio_url,
    groups,
  };
}

/** Słowa do Daily Word: para języków w katalogu + poziom wyświetlania (CEFR) z Supabase. */
export async function fetchVocabularyCandidatesForProfile(
  profile: UserProfile,
): Promise<VocabularyWord[]> {
  const { lemmaLanguageCode, glossLanguageCode } =
    getCatalogLanguagePair(profile);

  let rows = await fetchVocabularySenseDisplay({
    sourceLanguageCode: lemmaLanguageCode,
    targetLanguageCode: glossLanguageCode,
    cefrLevel: profile.displayLevel,
    limit: DAILY_WORD_CANDIDATE_LIMIT,
  });

  /**
   * Fallback: często `displayLevel` (np. A2 przy polityce „next-level” od A1) nie ma jeszcze rekordów
   * w seedzie, mimo że w bazie są słowa dla innych poziomów tej samej pary. Wtedy bierzemy słowa
   * dla całej pary języków (wszystkie CEFR), żeby Daily Word nie był pusty przy dostępnych danych.
   */
  if (rows.length === 0) {
    if (__DEV__) {
      console.warn(
        "[vocabularyApi] Brak słów dla displayLevel",
        profile.displayLevel,
        "(fallback: wszystkie CEFR dla pary katalogu)",
        `${lemmaLanguageCode} → ${glossLanguageCode}`,
      );
    }
    rows = await fetchVocabularySenseDisplay({
      sourceLanguageCode: lemmaLanguageCode,
      targetLanguageCode: glossLanguageCode,
      limit: DAILY_WORD_CANDIDATE_LIMIT,
    });
  }

  if (rows.length === 0) {
    return [];
  }

  /** Examples + extra lemma glosses are loaded only for the active/prefetched words in `enrichDailySnapshotForDisplay`. */
  const words = rows.map((row) =>
    mapSenseDisplayRowToVocabularyWord(row, undefined),
  );
  return words;
}

/**
 * Rozwiązuje `sense_id` → `VocabularyWord` dla danej pary językowej (np. lista „known”).
 * Zachowuje kolejność `senseIdsOrdered` (pomija brakujące w DB).
 */
export async function fetchVocabularyWordsBySenseIds(
  profile: UserProfile,
  senseIdsOrdered: string[],
): Promise<VocabularyWord[]> {
  if (!senseIdsOrdered.length || !hasSupabaseEnv()) {
    return [];
  }

  const { lemmaLanguageCode, glossLanguageCode } =
    getCatalogLanguagePair(profile);

  const unique = [...new Set(senseIdsOrdered)];

  const rows = await traceSupabase(
    `vocabulary_sense_display.by_sense_ids (${unique.length} ids, batched)`,
    async () => {
      const acc: VocabularySenseDisplayRow[] = [];
      const supabase = getSupabaseClient();
      for (const batch of chunkIds(unique, 200)) {
        const { data, error } = await supabase
          .from("vocabulary_sense_display")
          .select(VOCABULARY_SENSE_DISPLAY_COLUMNS)
          .in("sense_id", batch)
          .eq("source_language_code", lemmaLanguageCode)
          .eq("target_language_code", glossLanguageCode);

        if (error) {
          continue;
        }
        acc.push(...((data ?? []) as VocabularySenseDisplayRow[]));
      }
      return acc;
    },
  );

  if (rows.length === 0) {
    return [];
  }

  const examples = await fetchFirstExamplesBySenseIds(
    rows.map((r) => r.sense_id),
  );
  const byId = new Map(
    rows.map((row) => [
      row.sense_id,
      mapSenseDisplayRowToVocabularyWord(row, examples.get(row.sense_id)),
    ]),
  );

  const words = senseIdsOrdered
    .map((id) => byId.get(id))
    .filter((w): w is VocabularyWord => Boolean(w));
  return attachLemmaGlossDisplayLines(words, profile);
}
