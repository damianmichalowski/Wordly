import type { DailyWordSnapshot } from "@/src/types/dailyWord";
import type { VocabularyWord } from "@/src/types/words";

/**
 * Serwer zwraca „shell” snapshot (bez targetGlossParts / przykładów), podczas gdy UI
 * może już mieć wzbogacone dane z prefetchu lub tła. Scal, żeby nie migało:
 * wszystkie tłumaczenia → jedno → znowu wszystkie.
 */
function mergeWordPreserveRicherDisplay(
  prev: VocabularyWord | null | undefined,
  next: VocabularyWord,
): VocabularyWord {
  if (!prev || prev.id !== next.id) {
    return next;
  }
  const prevParts = prev.targetGlossParts?.length ?? 0;
  const nextParts = next.targetGlossParts?.length ?? 0;
  const preserveGlossParts =
    prevParts > 0 &&
    (nextParts === 0 || prevParts > nextParts);

  const merged: VocabularyWord = { ...next };

  if (preserveGlossParts && prev.targetGlossParts) {
    merged.targetGlossParts = prev.targetGlossParts;
    merged.targetText = prev.targetText || next.targetText;
  }

  if (!next.exampleSource?.trim() && prev.exampleSource?.trim()) {
    merged.exampleSource = prev.exampleSource;
  }
  if (!next.exampleTarget?.trim() && prev.exampleTarget?.trim()) {
    merged.exampleTarget = prev.exampleTarget;
  }
  if (!next.pronunciationText?.trim() && prev.pronunciationText?.trim()) {
    merged.pronunciationText = prev.pronunciationText;
  }
  if (!next.audioUrl && prev.audioUrl) {
    merged.audioUrl = prev.audioUrl;
  }

  return merged;
}

function mergeKnownQueues(
  prevQueue: VocabularyWord[] | undefined,
  nextQueue: VocabularyWord[] | undefined,
): VocabularyWord[] {
  if (!nextQueue?.length) {
    return nextQueue ?? [];
  }
  return nextQueue.map((nw, i) =>
    mergeWordPreserveRicherDisplay(prevQueue?.[i], nw),
  );
}

export function mergeDailySnapshotPreservingDisplayEnrichment(
  prev: DailyWordSnapshot | null | undefined,
  server: DailyWordSnapshot,
): DailyWordSnapshot {
  const activeWord =
    server.activeWord == null
      ? null
      : mergeWordPreserveRicherDisplay(
          prev?.activeWord ?? null,
          server.activeWord,
        );

  const prefetch =
    prev?.prefetch?.knownQueue && server.prefetch?.knownQueue
      ? {
          knownQueue: mergeKnownQueues(
            prev.prefetch.knownQueue,
            server.prefetch.knownQueue,
          ),
        }
      : server.prefetch;

  return {
    ...server,
    activeWord,
    prefetch,
  };
}
