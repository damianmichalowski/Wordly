import { getLibraryWords } from "@/src/features/revision/services/revisionRpc.service";
import type { VocabularyWord } from "@/src/types/words";

/** Paginated load of all known words for the Library tab list (same RPC as revision flows). */
export async function fetchAllLibraryWords(): Promise<VocabularyWord[]> {
  const out = [] as VocabularyWord[];
  let offset = 0;
  const page = 50;
  for (let i = 0; i < 10; i += 1) {
    const res = await getLibraryWords({ limit: page, offset });
    for (const it of res.items) {
      out.push({
        id: it.word_id,
        sourceLanguageCode: "en" as any,
        targetLanguageCode: "en" as any,
        sourceText: it.lemma,
        targetText: "",
        exampleSource: "",
        exampleTarget: "",
        cefrLevel: (it.cefr_code ?? "A1") as any,
        knownAt: it.known_at ?? null,
      });
    }
    if (!res.hasMore) {
      break;
    }
    offset += page;
  }
  return out;
}
