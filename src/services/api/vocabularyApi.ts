import { getCatalogLanguagePair } from "@/src/domain/vocabulary/catalogLanguagePair";
import { getSupabaseClient, hasSupabaseEnv } from "@/src/lib/supabase/client";
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
 * Reads normalized lemma + sense rows from `vocabulary_sense_display`.
 * Examples: query `vocabulary_examples` separately by `sense_id`.
 */
export async function fetchVocabularySenseDisplay(
  params: FetchVocabularySensesParams,
): Promise<VocabularySenseDisplayRow[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = getSupabaseClient();
  let q = supabase
    .from("vocabulary_sense_display")
    .select("*")
    .eq("source_language_code", params.sourceLanguageCode)
    .eq("target_language_code", params.targetLanguageCode);

  if (params.cefrLevel) {
    q = q.eq("cefr_level", params.cefrLevel);
  }

  // Nie sortujemy po `lemma_text`; kolejność „słów dnia” nie powinna iść alfabetycznie (A-Z).
  // `sense_id` daje stabilną, deterministyczną kolejność (UUID), sensowną dla progresji Daily Word.
  q = q.order("sense_id", { ascending: true });
  if (params.limit != null && params.limit > 0) {
    q = q.limit(params.limit);
  }

  const { data, error } = await q;

  if (error) {
    console.warn("[vocabularyApi] vocabulary_sense_display", error.message);
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

/**
 * Wszystkie `gloss_text` dla lematów (para języków z profilu), kolejność jak w szczegółach:
 * `part_of_speech`, potem `sense_index`.
 */
async function fetchLemmaGlossesOrderedByLemma(
  profile: UserProfile,
  lemmaIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!lemmaIds.length || !hasSupabaseEnv()) {
    return out;
  }
  const { lemmaLanguageCode, glossLanguageCode } =
    getCatalogLanguagePair(profile);
  const supabase = getSupabaseClient();
  const unique = [...new Set(lemmaIds)];

  type Row = {
    lemma_id: string;
    gloss_text: string;
    part_of_speech: string;
    sense_index: number;
  };

  for (const batch of chunkIds(unique, 200)) {
    const { data, error } = await supabase
      .from("vocabulary_sense_display")
      .select("lemma_id, gloss_text, part_of_speech, sense_index")
      .in("lemma_id", batch)
      .eq("source_language_code", lemmaLanguageCode)
      .eq("target_language_code", glossLanguageCode);

    if (error) {
      console.warn("[vocabularyApi] lemma glosses batch", error.message);
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

/**
 * Wszystkie przykłady (wg `sort_order`) dla każdego `sense_id`.
 */
export async function fetchAllExamplesBySenseIds(
  senseIds: string[],
): Promise<Map<string, { source: string; target: string | null }[]>> {
  const map = new Map<string, { source: string; target: string | null }[]>();
  if (!senseIds.length || !hasSupabaseEnv()) {
    return map;
  }

  const supabase = getSupabaseClient();
  const unique = [...new Set(senseIds)];

  for (const batch of chunkIds(unique, 200)) {
    const { data, error } = await supabase
      .from("vocabulary_examples")
      .select("sense_id, example_source_text, example_target_text, sort_order")
      .in("sense_id", batch)
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("[vocabularyApi] vocabulary_examples (all)", error.message);
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

  const supabase = getSupabaseClient();
  const { data: anchor, error: anchorErr } = await supabase
    .from("vocabulary_sense_display")
    .select("*")
    .eq("sense_id", senseId)
    .eq("source_language_code", lemmaLanguageCode)
    .eq("target_language_code", glossLanguageCode)
    .maybeSingle();

  if (anchorErr) {
    console.warn(
      "[vocabularyApi] fetchWordDetailBundle anchor",
      anchorErr.message,
    );
    return null;
  }

  const anchorRow = anchor as VocabularySenseDisplayRow | null;
  if (!anchorRow) {
    return null;
  }

  const { data: senseRows, error: sensesErr } = await supabase
    .from("vocabulary_sense_display")
    .select("*")
    .eq("lemma_id", anchorRow.lemma_id)
    .eq("source_language_code", lemmaLanguageCode)
    .eq("target_language_code", glossLanguageCode)
    .order("part_of_speech", { ascending: true })
    .order("sense_index", { ascending: true });

  if (sensesErr) {
    console.warn(
      "[vocabularyApi] fetchWordDetailBundle senses",
      sensesErr.message,
    );
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

  const senseIds = rows.map((r) => r.sense_id);
  const examples = await fetchFirstExamplesBySenseIds(senseIds);

  const words = rows.map((row) =>
    mapSenseDisplayRowToVocabularyWord(row, examples.get(row.sense_id)),
  );
  return attachLemmaGlossDisplayLines(words, profile);
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

  const supabase = getSupabaseClient();
  const unique = [...new Set(senseIdsOrdered)];
  const rows: VocabularySenseDisplayRow[] = [];

  for (const batch of chunkIds(unique, 200)) {
    const { data, error } = await supabase
      .from("vocabulary_sense_display")
      .select("*")
      .in("sense_id", batch)
      .eq("source_language_code", lemmaLanguageCode)
      .eq("target_language_code", glossLanguageCode);

    if (error) {
      console.warn(
        "[vocabularyApi] vocabulary_sense_display by ids",
        error.message,
      );
      continue;
    }
    rows.push(...((data ?? []) as VocabularySenseDisplayRow[]));
  }

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
