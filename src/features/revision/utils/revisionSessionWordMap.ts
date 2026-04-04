import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";
import type { VocabularyWord } from "@/src/types/words";

function dedupeStringsMax(strings: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of strings) {
    const s = raw.trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** Maps RPC `WordDetails` into a `VocabularyWord` for flashcard session decks. */
export function wordDetailsToVocabularyWord(d: WordDetails): VocabularyWord {
  const senses = d.senses ?? [];
  const first = senses[0];

  const glossCandidates: string[] = [];
  for (const s of senses) {
    const t = s.translation?.text?.trim() ?? "";
    if (t) glossCandidates.push(t);
  }
  const targetGlossParts = dedupeStringsMax(glossCandidates, 3);

  const exampleCandidates: string[] = [];
  const sortedSenses = [...senses].sort(
    (a, b) => (a.sense_order ?? 0) - (b.sense_order ?? 0),
  );
  for (const s of sortedSenses) {
    const exs = [...(s.translation?.examples ?? [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    for (const ex of exs) {
      const t = ex.text?.trim() ?? "";
      if (t) exampleCandidates.push(t);
    }
    if (exampleCandidates.length >= 3) break;
  }
  const examplePartsDeduped = dedupeStringsMax(exampleCandidates, 3);

  const primaryTarget = targetGlossParts[0] ?? first?.translation.text ?? "";
  const primaryExample =
    examplePartsDeduped[0] ??
    first?.translation.examples[0]?.text?.trim() ??
    "";

  return {
    id: d.word_id,
    sourceLanguageCode: d.target_language.code as any,
    targetLanguageCode: (first?.translation.native_language_id ?? "en") as any,
    sourceText: d.lemma,
    targetText: primaryTarget,
    targetGlossParts:
      targetGlossParts.length > 1 ? targetGlossParts : undefined,
    exampleSource: primaryExample,
    exampleParts:
      examplePartsDeduped.length > 1 ? examplePartsDeduped : undefined,
    exampleTarget: "",
    cefrLevel: (d.cefr.code ?? "A1") as any,
    knownAt: null,
    pronunciationText: d.ipa ?? undefined,
    audioUrl: null,
    partOfSpeech: first?.part_of_speech.name,
  };
}
