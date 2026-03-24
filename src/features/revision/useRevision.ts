import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import { PROFILE_SETTINGS_SAVED } from "@/src/events/profileSettingsEvents";
import { WORD_PROGRESS_UPDATED } from "@/src/events/wordProgressEvents";
import {
  buildSessionWordList,
  countWordsForLevelPreview,
  countWordsForMode,
} from "@/src/services/revision/revisionModeFilters";
import {
  fetchKnownWordsRevisionBundle,
  markWordReviewed,
  removeFromKnown as removeFromKnownStorage,
} from "@/src/services/revision/revisionService";
import { sortKnownWordsForRevision } from "@/src/services/revision/revisionSort";
import {
  DEFAULT_REVISION_SORT_PREFS,
  loadRevisionSortPrefs,
  saveRevisionSortPrefs,
  type RevisionSortPrefs,
} from "@/src/services/revision/revisionSortPrefs";
import { getUserProfile } from "@/src/services/storage/profileStorage";
import { shuffleArray } from "@/src/utils/shuffleArray";
import { cefrLevels, type CefrLevel } from "@/src/types/cefr";
import type {
  RevisionSessionConfig,
  RevisionSessionPhase,
} from "@/src/types/revisionSession";
import type { UserProfile } from "@/src/types/profile";
import type { UserWordProgress } from "@/src/types/progress";
import type { VocabularyWord } from "@/src/types/words";

export type RevisionMode = "list" | "flashcards";

export type { RevisionSortPrefs };

export type UseRevisionOptions = {
  /**
   * `hub`: zakładka Revision Hub (tryby powtórki).
   * `library`: zakładka Search (lista + wyszukiwarka).
   */
  variant?: "hub" | "library";
};

type RevisionBundle = {
  words: VocabularyWord[];
  progressByWordId: Record<string, UserWordProgress>;
};

type RevisionState = {
  isLoading: boolean;
  profile: UserProfile | null;
  revisionBundle: RevisionBundle | null;
  sortPrefs: RevisionSortPrefs;
  sessionPhase: RevisionSessionPhase;
  sessionConfig: RevisionSessionConfig | null;
  mode: RevisionMode;
  flashDeck: VocabularyWord[];
  index: number;
  isFlipped: boolean;
};

function createInitialRevisionState(
  variant: "hub" | "library",
): RevisionState {
  return {
    isLoading: true,
    profile: null,
    revisionBundle: null,
    sortPrefs: DEFAULT_REVISION_SORT_PREFS,
    sessionPhase: variant === "hub" ? "hub" : "library",
    sessionConfig: null,
    mode: "list",
    flashDeck: [],
    index: 0,
    isFlipped: false,
  };
}

export function useRevision(options?: UseRevisionOptions) {
  const variant: "hub" | "library" = options?.variant ?? "library";
  const variantRef = useRef(variant);
  variantRef.current = variant;

  const [state, setState] = useState<RevisionState>(() =>
    createInitialRevisionState(variant),
  );

  useEffect(() => {
    void loadRevisionSortPrefs().then((prefs) =>
      setState((prev) => ({ ...prev, sortPrefs: prefs })),
    );
  }, []);

  const knownWords = useMemo(() => {
    if (!state.revisionBundle) {
      return [];
    }
    return sortKnownWordsForRevision(
      state.revisionBundle.words,
      state.revisionBundle.progressByWordId,
      state.sortPrefs,
    );
  }, [state.revisionBundle, state.sortPrefs]);

  const sessionWords = useMemo(() => {
    if (
      state.sessionPhase !== "session" ||
      !state.sessionConfig ||
      !state.revisionBundle
    ) {
      return [];
    }
    return buildSessionWordList(
      state.revisionBundle,
      state.sessionConfig,
      state.sortPrefs,
    );
  }, [
    state.sessionPhase,
    state.sessionConfig,
    state.revisionBundle,
    state.sortPrefs,
  ]);

  const listWords = useMemo(() => {
    if (state.sessionPhase === "session") {
      return sessionWords;
    }
    return knownWords;
  }, [state.sessionPhase, sessionWords, knownWords]);

  const hubCounts = useMemo(() => {
    const emptyLevelCounts = Object.fromEntries(
      cefrLevels.map((lv) => [lv, 0]),
    ) as Record<CefrLevel, number>;

    if (!state.revisionBundle || !state.profile) {
      return {
        daily: 0,
        difficult: 0,
        recent: 0,
        all: 0,
        levelPreview: 0,
        levelCounts: emptyLevelCounts,
      };
    }
    const b = state.revisionBundle;
    const levelCounts = {} as Record<CefrLevel, number>;
    for (const lv of cefrLevels) {
      levelCounts[lv] = countWordsForMode(b, { kind: "level", level: lv });
    }
    return {
      daily: countWordsForMode(b, { kind: "daily" }),
      difficult: countWordsForMode(b, { kind: "difficult" }),
      recent: countWordsForMode(b, { kind: "recent" }),
      all: b.words.length,
      levelPreview: countWordsForLevelPreview(b, state.profile.displayLevel),
      levelCounts,
    };
  }, [state.revisionBundle, state.profile]);

  const resetPhase = useCallback(
    () => (variantRef.current === "hub" ? "hub" : "library"),
    [],
  );

  const refresh = useCallback(async () => {
    const profile = await getUserProfile();
    if (!profile) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        profile: null,
        revisionBundle: null,
        sessionPhase: resetPhase(),
        sessionConfig: null,
        mode: "list",
        flashDeck: [],
        index: 0,
        isFlipped: false,
      }));
      return;
    }

    const bundle = await fetchKnownWordsRevisionBundle(profile);

    setState((prev) => {
      if (prev.mode === "flashcards") {
        const deckSource =
          prev.sessionPhase === "session" && prev.sessionConfig
            ? buildSessionWordList(
                bundle,
                prev.sessionConfig,
                prev.sortPrefs,
              )
            : sortKnownWordsForRevision(
                bundle.words,
                bundle.progressByWordId,
                prev.sortPrefs,
              );
        const filtered = prev.flashDeck.filter((w) =>
          deckSource.some((k) => k.id === w.id),
        );
        if (filtered.length === 0) {
          return {
            ...prev,
            isLoading: false,
            profile,
            revisionBundle: bundle,
            mode: "list",
            flashDeck: [],
            index: 0,
            isFlipped: false,
          };
        }
        const newIndex = Math.min(prev.index, filtered.length - 1);
        return {
          ...prev,
          isLoading: false,
          profile,
          revisionBundle: bundle,
          flashDeck: filtered,
          index: newIndex,
        };
      }

      return {
        ...prev,
        isLoading: false,
        profile,
        revisionBundle: bundle,
      };
    });
  }, [resetPhase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PROFILE_SETTINGS_SAVED, () => {
      void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(WORD_PROGRESS_UPDATED, () => {
      void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const setRevisionSortPrefs = useCallback((prefs: RevisionSortPrefs) => {
    setState((prev) => ({ ...prev, sortPrefs: prefs }));
    void saveRevisionSortPrefs(prefs);
  }, []);

  const activeCard = useMemo(() => {
    if (state.mode !== "flashcards") {
      return null;
    }
    return state.flashDeck[state.index] ?? null;
  }, [state.mode, state.flashDeck, state.index]);

  const openRevisionHub = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sessionPhase: "hub",
      sessionConfig: null,
      mode: "list",
      flashDeck: [],
      index: 0,
      isFlipped: false,
    }));
  }, []);

  const closeHubToLibrary = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sessionPhase: "library",
      sessionConfig: null,
      mode: "list",
      flashDeck: [],
      index: 0,
      isFlipped: false,
    }));
  }, []);

  const enterSession = useCallback((config: RevisionSessionConfig) => {
    setState((prev) => {
      if (!prev.revisionBundle) {
        return {
          ...prev,
          sessionPhase: "session",
          sessionConfig: config,
          mode: "list",
          flashDeck: [],
          index: 0,
          isFlipped: false,
        };
      }
      const words = buildSessionWordList(
        prev.revisionBundle,
        config,
        prev.sortPrefs,
      );
      if (words.length === 0) {
        return {
          ...prev,
          sessionPhase: "session",
          sessionConfig: config,
          mode: "list",
          flashDeck: [],
          index: 0,
          isFlipped: false,
        };
      }
      return {
        ...prev,
        sessionPhase: "session",
        sessionConfig: config,
        mode: "flashcards",
        flashDeck: shuffleArray(words),
        index: 0,
        isFlipped: false,
      };
    });
  }, []);

  const exitSessionToHub = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sessionPhase: "hub",
      sessionConfig: null,
      mode: "list",
      flashDeck: [],
      index: 0,
      isFlipped: false,
    }));
  }, []);

  const startFlashcards = useCallback(() => {
    setState((prev) => {
      if (!prev.revisionBundle) {
        return prev;
      }
      const source =
        prev.sessionPhase === "session" && prev.sessionConfig
          ? buildSessionWordList(
              prev.revisionBundle,
              prev.sessionConfig,
              prev.sortPrefs,
            )
          : sortKnownWordsForRevision(
              prev.revisionBundle.words,
              prev.revisionBundle.progressByWordId,
              prev.sortPrefs,
            );
      if (source.length === 0) {
        return prev;
      }
      return {
        ...prev,
        mode: "flashcards",
        flashDeck: shuffleArray(source),
        index: 0,
        isFlipped: false,
      };
    });
  }, []);

  const exitFlashcards = useCallback(() => {
    setState((prev) => {
      const fromHubSession =
        variantRef.current === "hub" && prev.sessionPhase === "session";
      return {
        ...prev,
        sessionPhase: fromHubSession ? "hub" : prev.sessionPhase,
        sessionConfig: fromHubSession ? null : prev.sessionConfig,
        mode: "list",
        flashDeck: [],
        index: 0,
        isFlipped: false,
      };
    });
  }, []);

  const flip = useCallback(async () => {
    if (state.mode !== "flashcards" || !activeCard) {
      return;
    }

    const nextFlipped = !state.isFlipped;
    setState((prev) => ({ ...prev, isFlipped: nextFlipped }));

    if (!state.isFlipped) {
      await markWordReviewed(activeCard.id);
    }
  }, [state.mode, state.isFlipped, activeCard]);

  const next = useCallback(() => {
    setState((prev) => {
      const deck = prev.mode === "flashcards" ? prev.flashDeck : [];
      const len = deck.length;
      return {
        ...prev,
        index: len === 0 ? 0 : (prev.index + 1) % len,
        isFlipped: false,
      };
    });
  }, []);

  const previous = useCallback(() => {
    setState((prev) => {
      const deck = prev.mode === "flashcards" ? prev.flashDeck : [];
      const len = deck.length;
      if (len === 0 || prev.index <= 0) {
        return prev;
      }
      return {
        ...prev,
        index: prev.index - 1,
        isFlipped: false,
      };
    });
  }, []);

  const removeFromKnown = useCallback(async (wordId: string) => {
    await removeFromKnownStorage(wordId);
  }, []);

  return {
    isLoading: state.isLoading,
    profile: state.profile,
    knownWords: listWords,
    sortPrefs: state.sortPrefs,
    setRevisionSortPrefs,
    sessionPhase: state.sessionPhase,
    sessionConfig: state.sessionConfig,
    openRevisionHub,
    closeHubToLibrary,
    enterSession,
    exitSessionToHub,
    hubCounts,
    mode: state.mode,
    flashDeck: state.flashDeck,
    index: state.index,
    isFlipped: state.isFlipped,
    activeCard,
    startFlashcards,
    exitFlashcards,
    flip,
    next,
    previous,
    removeFromKnown,
    refresh,
  };
}
