import type { QueryClient } from "@tanstack/react-query";

import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";
import { queryKeys } from "@/src/lib/query/queryKeys";
import type { VocabularyWord } from "@/src/types/words";

/**
 * Merges the just-marked daily word into `library.allKnownWords` so the next Library
 * open can render the row immediately (no visible delayed insert after refetch).
 *
 * - Only updates when this query already has cached data (including `[]` after an
 *   empty fetch). If the cache is still `undefined`, the first Library load uses RPC.
 * - `known_at` is set to local ISO time; the next stale refetch replaces with server truth.
 * - Prepends the row (known_at desc) and dedupes by word id.
 */
export function patchLibraryCacheAfterMarkKnown(
  qc: QueryClient,
  args: { markedWordId: string; details: WordDetails | null | undefined },
): void {
  const { markedWordId, details } = args;
  if (!details || details.word_id !== markedWordId) {
    return;
  }

  const list = qc.getQueryData<VocabularyWord[]>(
    queryKeys.library.allKnownWords,
  );
  if (list === undefined) {
    return;
  }

  const knownAt = new Date().toISOString();

  const row: VocabularyWord = {
    id: markedWordId,
    sourceLanguageCode: "en" as VocabularyWord["sourceLanguageCode"],
    targetLanguageCode: "en" as VocabularyWord["targetLanguageCode"],
    sourceText: details.lemma,
    targetText: "",
    exampleSource: "",
    exampleTarget: "",
    cefrLevel: (details.cefr.code ?? "A1") as VocabularyWord["cefrLevel"],
    knownAt,
  };

  const without = list.filter((w) => w.id !== markedWordId);
  qc.setQueryData(queryKeys.library.allKnownWords, [row, ...without]);
}
