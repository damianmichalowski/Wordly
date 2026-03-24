import { cefrLevels } from "@/src/types/cefr";
import type { UserWordProgress } from "@/src/types/progress";
import type { VocabularyWord } from "@/src/types/words";

import type { RevisionSortPrefs } from "./revisionSortPrefs";

export function sortKnownWordsForRevision(
  words: VocabularyWord[],
  progressByWordId: Record<string, UserWordProgress>,
  prefs: RevisionSortPrefs,
): VocabularyWord[] {
  const cefrIdx = (w: VocabularyWord) => {
    const i = cefrLevels.indexOf(w.cefrLevel);
    return i < 0 ? 999 : i;
  };
  const ts = (id: string) => {
    const p = progressByWordId[id];
    return p?.markedKnownAt ?? p?.firstSeenAt ?? "";
  };

  const copy = [...words];
  copy.sort((a, b) => {
    if (prefs.cefrOrder !== "none") {
      const lc =
        prefs.cefrOrder === "asc"
          ? cefrIdx(a) - cefrIdx(b)
          : cefrIdx(b) - cefrIdx(a);
      if (lc !== 0) {
        return lc;
      }
    }
    const ta = ts(a.id);
    const tb = ts(b.id);
    return prefs.timeOrder === "newest"
      ? tb.localeCompare(ta)
      : ta.localeCompare(tb);
  });
  return copy;
}
