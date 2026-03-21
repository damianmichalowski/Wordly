import { useCallback, useEffect, useMemo, useState } from 'react';

import { getUserProfile } from '@/src/services/storage/profileStorage';
import { getKnownWordsForRevision, markWordReviewed } from '@/src/services/revision/revisionService';
import type { UserProfile } from '@/src/types/profile';
import type { VocabularyWord } from '@/src/types/words';

type RevisionState = {
  isLoading: boolean;
  profile: UserProfile | null;
  cards: VocabularyWord[];
  index: number;
  isFlipped: boolean;
};

export function useRevision() {
  const [state, setState] = useState<RevisionState>({
    isLoading: true,
    profile: null,
    cards: [],
    index: 0,
    isFlipped: false,
  });

  const refresh = useCallback(async () => {
    const profile = await getUserProfile();
    if (!profile) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        profile: null,
        cards: [],
        index: 0,
        isFlipped: false,
      }));
      return;
    }

    const cards = await getKnownWordsForRevision(profile);
    setState((prev) => ({
      ...prev,
      isLoading: false,
      profile,
      cards,
      index: 0,
      isFlipped: false,
    }));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeCard = useMemo(() => state.cards[state.index] ?? null, [state.cards, state.index]);

  const flip = useCallback(async () => {
    if (!activeCard) {
      return;
    }

    const nextFlipped = !state.isFlipped;
    setState((prev) => ({ ...prev, isFlipped: nextFlipped }));

    if (!state.isFlipped) {
      await markWordReviewed(activeCard.id);
    }
  }, [activeCard, state.isFlipped]);

  const next = useCallback(() => {
    setState((prev) => ({
      ...prev,
      index: prev.cards.length === 0 ? 0 : (prev.index + 1) % prev.cards.length,
      isFlipped: false,
    }));
  }, []);

  const previous = useCallback(() => {
    setState((prev) => ({
      ...prev,
      index: prev.cards.length === 0 ? 0 : (prev.index - 1 + prev.cards.length) % prev.cards.length,
      isFlipped: false,
    }));
  }, []);

  return {
    ...state,
    activeCard,
    flip,
    next,
    previous,
    refresh,
  };
}
