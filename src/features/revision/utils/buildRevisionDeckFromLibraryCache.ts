import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/src/lib/query/queryKeys";
import type { RevisionSessionConfig } from "@/src/types/revisionSession";
import type { VocabularyWord } from "@/src/types/words";
import { shuffleArray } from "@/src/utils/shuffleArray";

const OFFLINE_REVISION_MAX_CARDS = 50;

/**
 * Fallback deck when RPC is unavailable: same persisted catalog as Library (`allKnownWords`).
 */
export function buildRevisionDeckFromLibraryCache(
  queryClient: QueryClient,
  config: RevisionSessionConfig,
): { knownWords: VocabularyWord[]; flashDeck: VocabularyWord[] } | null {
  const words = queryClient.getQueryData<VocabularyWord[]>(
    queryKeys.library.allKnownWords,
  );
  if (!words || words.length === 0) {
    return null;
  }

  const shuffled = shuffleArray([...words]);
  let takeCount: number;
  if (config.kind === "quick") {
    takeCount = Math.min(config.count, shuffled.length);
  } else if (config.kind === "recent") {
    takeCount = Math.min(config.count, shuffled.length);
  } else if (config.kind === "difficultWords") {
    takeCount = Math.min(config.limit, shuffled.length);
  } else {
    takeCount = Math.min(OFFLINE_REVISION_MAX_CARDS, shuffled.length);
  }
  const selected = shuffled.slice(0, takeCount);
  const flashDeck = shuffleArray(selected);
  return { knownWords: selected, flashDeck };
}
