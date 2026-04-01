import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LanguageCode } from '@/src/types/language';

/** Maks. liczba przykładów z sieci (cache + API). */
export const MAX_EXTERNAL_USAGE_EXAMPLES = 3;

/** v3: tylko angielskie zdania, bez linii tłumaczenia. */
const CACHE_PREFIX = 'wordly_usage_examples_v3';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const DICTIONARY_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries';
const TATOEBA_SENTENCES = 'https://api.tatoeba.org/unstable/sentences';

/** ISO 639-3 dla Tatoeba (`lang`): używamy wyłącznie korpusu angielskiego. */
const TATOEBA_ENG = 'eng';

/** Same key as `buildCacheKey`, dedupes concurrent fetches before AsyncStorage fills. */
const inFlightExternalExamples = new Map<string, Promise<UsageExampleLine[]>>();

type DictionaryEntry = {
  meanings?: { definitions?: { example?: string }[] }[];
};

/** Jedna linia: zdanie po angielsku (bez tłumaczenia). */
export type UsageExampleLine = { source: string };

function normalizeLemma(lemma: string): string {
  return lemma.trim();
}

type CachedUsagePayload = {
  savedAt: number;
  rows: UsageExampleLine[];
};

function buildCacheKey(lemmaNorm: string, from: LanguageCode, to: LanguageCode): string {
  const safe = lemmaNorm.toLowerCase().slice(0, 120);
  return `${CACHE_PREFIX}:${from}:${to}:${safe}`;
}

async function readUsageCache(key: string): Promise<UsageExampleLine[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedUsagePayload;
    if (!parsed?.rows || !Array.isArray(parsed.rows)) {
      return null;
    }
    if (Date.now() - (parsed.savedAt ?? 0) > CACHE_TTL_MS) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return parsed.rows.map((r) => ({
      source: normalizeDisplayText(typeof r.source === 'string' ? r.source : ''),
    }));
  } catch {
    return null;
  }
}

async function writeUsageCache(key: string, rows: UsageExampleLine[]): Promise<void> {
  try {
    const payload: CachedUsagePayload = { savedAt: Date.now(), rows };
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* ignore quota / serialization */
  }
}

/**
 * Czasem API zwraca fragmenty jak po URL-encode (%20, +).
 */
export function normalizeDisplayText(text: string): string {
  const t = text.replace(/\+/g, ' ').trim();
  if (!t.includes('%')) {
    return t;
  }
  try {
    return decodeURIComponent(t);
  } catch {
    return t.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
}

function uniqueShortSentences(sentences: string[], max: number, maxWords = 22): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of sentences) {
    const t = s.replace(/\s+/g, ' ').trim();
    if (!t || t.length > 220) {
      continue;
    }
    const words = t.split(/\s+/).length;
    if (words > maxWords) {
      continue;
    }
    const key = t.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(t);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function extractExamplesFromFreeDictionary(entries: DictionaryEntry[] | null): string[] {
  if (!entries || !Array.isArray(entries)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    for (const m of entry.meanings ?? []) {
      for (const d of m.definitions ?? []) {
        const ex = d.example?.trim();
        if (ex) {
          out.push(ex);
        }
      }
    }
  }
  return uniqueShortSentences(out, MAX_EXTERNAL_USAGE_EXAMPLES + 2);
}

async function fetchFreeDictionaryEnglishExamples(lemma: string): Promise<string[]> {
  const w = encodeURIComponent(normalizeLemma(lemma));
  const data = await fetchJson<DictionaryEntry[] | { title?: string }>(`${DICTIONARY_API_BASE}/en/${w}`);
  if (!data || !Array.isArray(data)) {
    return [];
  }
  return extractExamplesFromFreeDictionary(data);
}

type TatoebaSentenceResponse = {
  data?: { text?: string }[];
};

/** Zdania z Tatoeba wyłącznie z korpusu angielskiego. */
async function fetchTatoebaEnglishExamples(lemma: string, limit: number): Promise<string[]> {
  const q = encodeURIComponent(normalizeLemma(lemma));
  const url = `${TATOEBA_SENTENCES}?q=${q}&lang=${TATOEBA_ENG}&sort=words`;
  const data = await fetchJson<TatoebaSentenceResponse>(url);
  const texts = (data?.data ?? [])
    .map((r) => r.text?.trim())
    .filter((t): t is string => Boolean(t));
  const needle = normalizeLemma(lemma).toLowerCase();
  const containsLemma = texts.filter((t) => t.toLowerCase().includes(needle));
  return uniqueShortSentences(containsLemma.length > 0 ? containsLemma : texts, limit);
}

/**
 * Krótkie przykłady **po angielsku** (Free Dictionary + Tatoeba EN).
 * Gdy lemat nie jest w języku angielskim (`sourceLanguageCode !== 'en'`), nie pobieramy z sieci:
 * brak sensownego dopasowania angielskich zdań do polskiego hasła bez osobnego mapowania.
 */
export async function fetchExternalUsageExamples(params: {
  lemma: string;
  sourceLanguageCode: LanguageCode;
  targetLanguageCode: LanguageCode;
  maxExamples?: number;
}): Promise<UsageExampleLine[]> {
  const { lemma, sourceLanguageCode, targetLanguageCode, maxExamples = MAX_EXTERNAL_USAGE_EXAMPLES } = params;
  const lemmaNorm = normalizeLemma(lemma);
  if (!lemmaNorm) {
    return [];
  }

  if (sourceLanguageCode !== 'en') {
    return [];
  }

  const cacheKey = buildCacheKey(lemmaNorm, sourceLanguageCode, targetLanguageCode);
  const cached = await readUsageCache(cacheKey);
  if (cached && cached.length > 0) {
    return cached.slice(0, maxExamples);
  }

  const inflight = inFlightExternalExamples.get(cacheKey);
  if (inflight) {
    const rows = await inflight;
    return rows.slice(0, maxExamples);
  }

  const fetchPromise = (async (): Promise<UsageExampleLine[]> => {
    const sentences: string[] = [];

    const fromDict = await fetchFreeDictionaryEnglishExamples(lemmaNorm);
    sentences.push(...fromDict.map((s) => normalizeDisplayText(s)));

    const fromTatoeba = await fetchTatoebaEnglishExamples(lemmaNorm, maxExamples + 2);
    for (const s of fromTatoeba) {
      const cleaned = normalizeDisplayText(s);
      if (!sentences.includes(cleaned)) {
        sentences.push(cleaned);
      }
    }

    const unique = uniqueShortSentences(sentences, maxExamples);
    const out: UsageExampleLine[] = unique.map((source) => ({ source }));

    if (out.length > 0) {
      await writeUsageCache(cacheKey, out);
    }

    return out;
  })();

  inFlightExternalExamples.set(cacheKey, fetchPromise);
  void fetchPromise.finally(() => {
    inFlightExternalExamples.delete(cacheKey);
  });
  return fetchPromise;
}
