import { buildSessionWordList } from "@/src/services/revision/revisionModeFilters";
import {
  DEFAULT_REVISION_SORT_PREFS,
  type RevisionSortPrefs,
} from "@/src/services/revision/revisionSortPrefs";
import { sortKnownWordsForRevision } from "@/src/services/revision/revisionSort";
import type { KnownWordsRevisionBundle } from "@/src/services/knownWordsService";
import type { RevisionSessionConfig } from "@/src/types/revisionSession";
import type { VocabularyWord } from "@/src/types/words";
import { shuffleArray } from "@/src/utils/shuffleArray";

/**
 * Revision entry points that operate on the **cached** known-words bundle when possible
 * (call {@link loadKnownWordsRevisionBundleFromRemote} to refresh from Supabase).
 */
export function getRevisionSession(
  bundle: KnownWordsRevisionBundle,
  config: RevisionSessionConfig,
  sortPrefs: RevisionSortPrefs = DEFAULT_REVISION_SORT_PREFS,
): VocabularyWord[] {
  return buildSessionWordList(bundle, config, sortPrefs);
}

export function getFlashcardSet(
  bundle: KnownWordsRevisionBundle,
  config: RevisionSessionConfig,
  sortPrefs: RevisionSortPrefs = DEFAULT_REVISION_SORT_PREFS,
): VocabularyWord[] {
  return shuffleArray(getRevisionSession(bundle, config, sortPrefs));
}

export function getRandomKnownWords(
  bundle: KnownWordsRevisionBundle,
  count: number,
  sortPrefs: RevisionSortPrefs = DEFAULT_REVISION_SORT_PREFS,
): VocabularyWord[] {
  const sorted = sortKnownWordsForRevision(
    bundle.words,
    bundle.progressByWordId,
    sortPrefs,
  );
  const n = Math.max(0, Math.min(count, sorted.length));
  return shuffleArray(sorted).slice(0, n);
}
