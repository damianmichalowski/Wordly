import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { patchWordDetailsIsDifficult } from "@/src/features/word-progress/utils/patchWordDetailsDifficult";
import { patchWordGraduatedFromDifficult } from "@/src/features/word-progress/utils/patchWordGraduatedFromDifficult";
import { queryKeys } from "@/src/lib/query/queryKeys";
import {
  setWordDifficult,
  setWordDifficultCorrectStreak,
  setWordDifficultDontKnowCounter,
} from "@/src/services/wordProgress/wordProgress.service";
import { clearAllRevisionSessionDecks } from "@/src/services/revision/revisionSessionDeckCache";
import {
  emitWordDifficultToggled,
  emitWordProgressUpdated,
} from "@/src/events/wordProgressEvents";
import { logUserAction } from "@/src/utils/userActionLog";

type Options = {
  wordId: string;
  /** From `WordDetails.is_difficult` or `VocabularyWord.isDifficult`. */
  initialMarked?: boolean;
};

export function useToggleWordDifficult({ wordId, initialMarked = false }: Options) {
  const queryClient = useQueryClient();
  const [isMarked, setIsMarked] = useState(initialMarked);

  useEffect(() => {
    setIsMarked(initialMarked);
  }, [initialMarked, wordId]);

  const mutation = useMutation({
    mutationFn: async (nextMarked: boolean) => {
      if (nextMarked) {
        await setWordDifficult(wordId, true);
      } else {
        await setWordDifficult(wordId, false);
        await setWordDifficultCorrectStreak(wordId, 0);
        await setWordDifficultDontKnowCounter(wordId, 0);
      }
      return nextMarked;
    },
    onMutate: async (nextMarked) => {
      setIsMarked(nextMarked);
      if (nextMarked) {
        patchWordDetailsIsDifficult(queryClient, wordId, true);
      } else {
        patchWordGraduatedFromDifficult(queryClient, wordId);
      }
      return { previousMarked: !nextMarked };
    },
    onError: (_err, _nextMarked, context) => {
      if (!context) {
        return;
      }
      setIsMarked(context.previousMarked);
      patchWordDetailsIsDifficult(
        queryClient,
        wordId,
        context.previousMarked,
      );
    },
    onSuccess: (nextMarked) => {
      void clearAllRevisionSessionDecks();
      void queryClient.invalidateQueries({
        queryKey: queryKeys.revision.hubStats,
      });
      emitWordDifficultToggled(
        nextMarked
          ? { wordId, isDifficult: true }
          : { wordId, isDifficult: false, difficultDontKnowCounter: 0 },
      );
      emitWordProgressUpdated();
    },
  });

  const toggle = useCallback(() => {
    const next = !isMarked;
    logUserAction("button_press", {
      target: next ? "word_mark_difficult" : "word_unmark_difficult",
      wordId,
    });
    mutation.mutate(next);
  }, [isMarked, mutation, wordId]);

  return {
    isMarked,
    toggle,
    isPending: mutation.isPending,
  };
}
