import { deriveVisibleTranslationLines } from "@/src/features/daily-word/utils/visibleCardTranslations";
import type { VocabularyWord } from "@/src/types/words";

const MAX = 3;

function dedupeAdd(
  out: string[],
  seen: Set<string>,
  raw: string,
): void {
  const t = raw.trim();
  if (!t) return;
  const k = t.toLowerCase();
  if (seen.has(k)) return;
  seen.add(k);
  out.push(t);
}

/** Rozbija pojedyncze pole z separatorem „*” na osobne linie (bez gwiazdek w treści). */
function expandAsteriskSeparated(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const parts = raw
      .split(/\s*\*\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of parts) {
      out.push(p);
    }
  }
  return out;
}

/** Do 3 tłumaczeń (sensów) na tył fiszki, każde w osobnej linii, bez „*” między nimi. */
export function getRevisionTranslationLines(word: VocabularyWord): string[] {
  let lines: string[];
  if (word.targetGlossParts && word.targetGlossParts.length > 0) {
    lines = [...word.targetGlossParts];
  } else {
    lines = deriveVisibleTranslationLines(word);
  }
  return expandAsteriskSeparated(lines).slice(0, MAX);
}

/**
 * Do 3 przykładów: najpierw z bazy (`exampleParts` / `exampleSource`),
 * potem uzupełnienie z sieci (EN), bez duplikatów.
 */
export function getRevisionExampleLines(
  word: VocabularyWord,
  online: { source: string }[] | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  if (word.exampleParts?.length) {
    for (const x of word.exampleParts) {
      if (out.length >= MAX) break;
      dedupeAdd(out, seen, x);
    }
  } else if (word.exampleSource?.trim()) {
    dedupeAdd(out, seen, word.exampleSource);
  }

  if (online && word.sourceLanguageCode === "en") {
    for (const row of online) {
      if (out.length >= MAX) break;
      dedupeAdd(out, seen, row.source);
    }
  }

  return out.slice(0, MAX);
}
