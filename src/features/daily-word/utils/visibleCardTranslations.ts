import type { VocabularyWord } from "@/src/types/words";

function dedupePreserveOrder(strings: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of strings) {
    const t = s.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/**
 * Linie tłumaczenia na karcie „Słowo dnia” (jeden wiersz `vocabulary_sense_display` = jeden sens).
 *
 * - Po wzbogaceniu: jak wcześniej, **wszystkie glosy lematu** (`targetGlossParts` z
 *   `attachLemmaGlossDisplayLines`), żeby pokazać parę/kilka tłumaczeń rozróżniających sensy.
 * - W shellu / bez listy: dzielenie `targetText` na `·` lub `/`, gdy kilka glossów jest w jednym polu.
 */
export function deriveVisibleTranslationLines(word: VocabularyWord): string[] {
  const primary = word.targetText?.trim() ?? "";
  if (!primary) {
    return [];
  }

  const lemmaParts = word.targetGlossParts;
  if (lemmaParts && lemmaParts.length > 1) {
    return dedupePreserveOrder(lemmaParts);
  }

  const splitFromTarget = primary
    .split(/\s*·\s*|\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (splitFromTarget.length > 1) {
    return splitFromTarget;
  }

  if (lemmaParts && lemmaParts.length === 1) {
    const one = lemmaParts[0].trim();
    return [one || primary];
  }

  return [primary];
}

/** Builds a VocabularyWord safe for the focal card renderer (FormattedTranslationGlosses). */
export function toVisibleCardWordForTranslation(word: VocabularyWord): VocabularyWord {
  const lines = deriveVisibleTranslationLines(word);
  if (lines.length === 0) {
    return word;
  }
  if (lines.length === 1) {
    return {
      ...word,
      targetText: lines[0],
      targetGlossParts: undefined,
    };
  }
  return {
    ...word,
    targetText: lines[0],
    targetGlossParts: lines,
  };
}
