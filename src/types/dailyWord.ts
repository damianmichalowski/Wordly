import type { CefrLevel } from "@/src/types/cefr";
import type { VocabularyWord } from "@/src/types/words";

export type DailyWordSnapshot = {
  activeWord: VocabularyWord | null;
  knownCount: number;
  skippedCount: number;
  remainingCount: number;
  totalCandidateCount: number;
  stateVersion: number;
  updatedAt: string;
  emptyReason?:
    | "onboarding-incomplete"
    | "no-words-for-config"
    | "all-words-completed";
  levelAdvanced?: { from: CefrLevel; to: CefrLevel };
  prefetch?: {
    knownQueue: VocabularyWord[];
  };
};
