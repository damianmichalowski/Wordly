import { getLibraryWords } from "@/src/features/revision/services/revisionRpc.service";
import type { LibraryCollectionFilter } from "@/src/types/revisionTracking";
import type { VocabularyWord } from "@/src/types/words";

export type FetchLibraryWordsOptions = {
  collection?: LibraryCollectionFilter;
  search?: string;
  cefrCodes?: string[];
  categoryCodes?: string[];
  sortKnownAt?: "asc" | "desc";
};

/** Paginated load of known words for the Library tab list — all filtering is backend-backed. */
export async function fetchAllLibraryWords(
  options?: FetchLibraryWordsOptions,
): Promise<VocabularyWord[]> {
  const out = [] as VocabularyWord[];
  let offset = 0;
  const page = 50;
  for (let i = 0; i < 10; i += 1) {
    const res = await getLibraryWords({
      limit: page,
      offset,
      collection: options?.collection,
      search: options?.search,
      cefrCodes: options?.cefrCodes,
      categoryCodes: options?.categoryCodes,
      sortKnownAt: options?.sortKnownAt,
    });
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
        nextReviewAt: it.next_review_at ?? null,
        intervalDays: it.interval_days ?? 0,
        isDifficult: it.is_difficult === true ? true : undefined,
      });
    }
    if (!res.hasMore) {
      break;
    }
    offset += page;
  }
  return out;
}
