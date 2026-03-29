import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import { PROFILE_SETTINGS_SAVED } from "@/src/events/profileSettingsEvents";
import { WORD_PROGRESS_UPDATED } from "@/src/events/wordProgressEvents";
import {
  buildSessionWordList,
  countWordsForMode,
} from "@/src/services/revision/revisionModeFilters";
import {
  fetchKnownWordsRevisionBundle,
  loadKnownWordsRevisionBundleFromRemote,
  markWordReviewed,
  removeFromKnown as removeFromKnownStorage,
} from "@/src/services/knownWordsService";
import {
  ensureRevisionProgressFlushOnBackground,
  flushRevisionReviewProgressBatches,
} from "@/src/services/revision/revisionSessionProgressSync";
import { getKnownWordsBundleCache } from "@/src/cache/knownWordsCache";
import { sortKnownWordsForRevision } from "@/src/services/revision/revisionSort";
import {
  DEFAULT_REVISION_SORT_PREFS,
  loadRevisionSortPrefs,
  saveRevisionSortPrefs,
  type RevisionSortPrefs,
} from "@/src/services/revision/revisionSortPrefs";
import { getUserProfile } from "@/src/services/storage/profileStorage";
import { LogTag, logger } from "@/src/utils/logger";
import { shuffleArray } from "@/src/utils/shuffleArray";
import {
  encodeRevisionSessionMode,
  type RevisionSessionCompletionStats,
  type RevisionSessionConfig,
  type RevisionSessionPhase,
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

/**
 * When the known-words bundle changes while flashcards are open, refresh card
 * payloads from the bundle but do **not** re-run {@link buildSessionWordList}.
 * Re-building session filters after a review (e.g. Daily “due today”) can drop
 * the current sense_id and change `index`, so „Pokaż tłumaczenie” looked like
 * it jumped to another word.
 *
 * Only words still present in `bundle.words` stay in the deck; order is kept;
 * `index` follows the same sense_id when possible.
 */
function flashcardAdjustmentsForBundleChange(
  prev: RevisionState,
  bundle: RevisionBundle,
): Partial<RevisionState> {
  if (prev.mode !== "flashcards") {
    return {};
  }
  const wordById = new Map(bundle.words.map((w) => [w.id, w]));
  const resynced = prev.flashDeck
    .filter((w) => wordById.has(w.id))
    .map((w) => wordById.get(w.id)!);
  if (resynced.length === 0) {
    return {
      mode: "list",
      flashDeck: [],
      index: 0,
      isFlipped: false,
    };
  }
  const currentId = prev.flashDeck[prev.index]?.id;
  let newIndex = Math.min(prev.index, resynced.length - 1);
  if (currentId !== undefined) {
    const pos = resynced.findIndex((w) => w.id === currentId);
    if (pos >= 0) {
      newIndex = pos;
    }
  }
  return {
    flashDeck: resynced,
    index: newIndex,
  };
}

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

  const stateRef = useRef(state);
  stateRef.current = state;

  /** Wall-clock start of the current hub revision flash session (for completion stats). */
  const flashSessionStartedAtMsRef = useRef<number | null>(null);

  useEffect(() => {
    void loadRevisionSortPrefs().then((prefs) =>
      setState((prev) => ({ ...prev, sortPrefs: prefs })),
    );
  }, []);

  useEffect(() => {
    if (state.mode !== "flashcards") {
      flashSessionStartedAtMsRef.current = null;
    }
  }, [state.mode]);

  const revisionOpenedLogged = useRef(false);
  useEffect(() => {
    if (state.isLoading || !state.profile || revisionOpenedLogged.current) {
      return;
    }
    revisionOpenedLogged.current = true;
    logger.info(LogTag.REVISION, `Revision mode opened (variant=${variant})`);
  }, [state.isLoading, state.profile, variant]);

  const flashDeckSigLogged = useRef<string>("");
  useEffect(() => {
    if (state.mode !== "flashcards" || state.flashDeck.length === 0) {
      return;
    }
    const sig = state.flashDeck.map((w) => w.id).join("|");
    if (flashDeckSigLogged.current === sig) {
      return;
    }
    flashDeckSigLogged.current = sig;
    logger.info(LogTag.REVISION, "Loading flashcard set");
    logger.info(
      LogTag.REVISION,
      `Flashcard set size: ${state.flashDeck.length}`,
    );
  }, [state.mode, state.flashDeck]);

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
    if (!state.revisionBundle || !state.profile) {
      return {
        daily: 0,
        recent: 0,
        all: 0,
      };
    }
    const b = state.revisionBundle;
    return {
      daily: countWordsForMode(b, { kind: "daily" }),
      recent: countWordsForMode(b, { kind: "recent" }),
      all: b.words.length,
    };
  }, [state.revisionBundle, state.profile]);

  useEffect(() => {
    if (state.isLoading || !state.profile || !state.revisionBundle) {
      return;
    }
    const n = hubCounts.all;
    const quickUnlocked = n >= 5;
    logger.info(LogTag.REVISION_HUB, "Recomputed mode availability");
    logger.info(
      LogTag.REVISION_HUB,
      `Daily Review available count=${hubCounts.daily}`,
    );
    logger.info(
      LogTag.REVISION_HUB,
      `Quick Practice unlocked=${quickUnlocked}`,
    );
    logger.info(
      LogTag.REVISION_HUB,
      `Recently Learned available count=${hubCounts.recent}`,
    );
  }, [state.isLoading, state.profile, state.revisionBundle, hubCounts]);

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

    const cached = await getKnownWordsBundleCache(profile.userId, {
      silent: true,
    });

    if (cached) {
      const bundle: RevisionBundle = {
        words: cached.words,
        progressByWordId: cached.progressByWordId,
      };
      logger.info(
        LogTag.REVISION_HUB,
        `Loaded known words from local cache (${bundle.words.length} words)`,
      );
      setState((prev) => ({
        ...prev,
        isLoading: false,
        profile,
        revisionBundle: bundle,
        ...flashcardAdjustmentsForBundleChange(prev, bundle),
      }));
      void (async () => {
        try {
          await flushRevisionReviewProgressBatches(profile.userId);
          const fresh = await loadKnownWordsRevisionBundleFromRemote(profile);
          const freshBundle: RevisionBundle = {
            words: fresh.words,
            progressByWordId: fresh.progressByWordId,
          };
          logger.info(
            LogTag.REVISION_HUB,
            `Background canonical sync complete (${freshBundle.words.length} words)`,
          );
          setState((prev) => {
            if (prev.profile?.userId !== profile.userId) {
              return prev;
            }
            return {
              ...prev,
              revisionBundle: freshBundle,
              ...flashcardAdjustmentsForBundleChange(prev, freshBundle),
            };
          });
        } catch (e) {
          logger.warn(
            LogTag.REVISION_HUB,
            "Background known-words sync failed (local cache unchanged)",
            e,
          );
        }
      })();
      return;
    }

    logger.info(
      LogTag.REVISION_HUB,
      "No local bundle — blocking fetch from Supabase (first run)",
    );
    await flushRevisionReviewProgressBatches(profile.userId);
    const bundle = await fetchKnownWordsRevisionBundle(profile);

    setState((prev) => ({
      ...prev,
      isLoading: false,
      profile,
      revisionBundle: bundle,
      ...flashcardAdjustmentsForBundleChange(prev, bundle),
    }));
  }, [resetPhase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    ensureRevisionProgressFlushOnBackground();
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PROFILE_SETTINGS_SAVED, () => {
      void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(WORD_PROGRESS_UPDATED, () => {
      void (async () => {
        const profile = await getUserProfile();
        if (!profile) {
          return;
        }
        const cached = await getKnownWordsBundleCache(profile.userId, {
          silent: true,
        });
        if (!cached) {
          return;
        }
        logger.info(LogTag.REVISION_HUB, "Loaded known words from memory");
        const bundle: RevisionBundle = {
          words: cached.words,
          progressByWordId: cached.progressByWordId,
        };
        setState((prev) => {
          if (!prev.profile || prev.profile.userId !== profile.userId) {
            return prev;
          }
          return {
            ...prev,
            revisionBundle: bundle,
            ...flashcardAdjustmentsForBundleChange(prev, bundle),
          };
        });
      })();
    });
    return () => sub.remove();
  }, []);

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
        logger.warn(
          LogTag.REVISION_SESSION,
          "Cannot start session — revision bundle not loaded yet",
        );
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
        logger.info(LogTag.REVISION_SESSION, "Session created with 0 cards");
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
      logger.info(
        LogTag.REVISION_SESSION,
        `Session created with ${words.length} cards`,
      );
      flashSessionStartedAtMsRef.current = Date.now();
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
    void flushRevisionReviewProgressBatches();
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
      if (variantRef.current === "hub" && prev.sessionPhase === "session") {
        flashSessionStartedAtMsRef.current = Date.now();
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
    flashSessionStartedAtMsRef.current = null;
    void flushRevisionReviewProgressBatches();
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

  /**
   * Finishes a hub revision session from the last flashcard (“Koniec”).
   * Returns stats for the completion screen, or `null` if this was not a hub session run.
   */
  const completeRevisionSession = useCallback((): RevisionSessionCompletionStats | null => {
    void flushRevisionReviewProgressBatches();
    const prev = stateRef.current;
    const isHubSession =
      variantRef.current === "hub" &&
      prev.sessionPhase === "session" &&
      prev.flashDeck.length > 0;
    if (!isHubSession) {
      return null;
    }
    const stats: RevisionSessionCompletionStats = {
      cardsReviewed: prev.flashDeck.length,
      sessionDurationMs:
        flashSessionStartedAtMsRef.current != null
          ? Date.now() - flashSessionStartedAtMsRef.current
          : 0,
      mode: prev.sessionConfig
        ? encodeRevisionSessionMode(prev.sessionConfig)
        : "unknown",
    };
    logger.info(LogTag.REVISION, "Session completed");
    flashSessionStartedAtMsRef.current = null;
    setState((s) => ({
      ...s,
      sessionPhase: "hub",
      sessionConfig: null,
      mode: "list",
      flashDeck: [],
      index: 0,
      isFlipped: false,
    }));
    return stats;
  }, []);

  const flip = useCallback(() => {
    if (state.mode !== "flashcards" || !activeCard) {
      return;
    }

    const nextFlipped = !state.isFlipped;
    setState((prev) => ({ ...prev, isFlipped: nextFlipped }));

    if (!state.isFlipped) {
      logger.info(
        LogTag.REVISION_SESSION,
        `Reveal translation (local), sense_id=${activeCard.id}`,
      );
      void markWordReviewed(activeCard.id);
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
    completeRevisionSession,
    flip,
    next,
    previous,
    removeFromKnown,
    refresh,
  };
}
