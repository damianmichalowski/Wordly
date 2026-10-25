export type RevisionFlashcardAnswerKind = "know" | "dontKnow";

export type RevisionAnswerUndoEntry = {
  cardIndex: number;
  wordId: string;
  kind: RevisionFlashcardAnswerKind;
  difficultWordsMode: boolean;
  previousStreak: number;
  previousIsDifficult: boolean | undefined;
  previousDontKnowCounter: number;
  /** Normal mode: word already difficult — only streak was reset. */
  dontKnowResetStreakOnly?: boolean;
  /** Normal mode: know decremented dont-know counter by 1. */
  knowDecrementedCounter?: boolean;
};

export type FlashcardSubmitResult = "advanced" | "complete";
