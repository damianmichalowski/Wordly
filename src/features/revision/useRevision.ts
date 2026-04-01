import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";
import { getUserProfileSettings } from "@/src/features/profile/services/profile.service";
import type { RevisionHubCounts } from "@/src/features/revision/components/RevisionHub";
import {
  DEFAULT_REVISION_SORT_PREFS,
  loadRevisionSortPrefs,
  saveRevisionSortPrefs,
  type RevisionSortPrefs,
} from "@/src/services/revision/revisionSortPrefs";
import {
  encodeRevisionSessionMode,
  type RevisionSessionCompletionStats,
  type RevisionSessionConfig,
  type RevisionSessionPhase,
} from "@/src/types/revisionSession";
import type { VocabularyWord } from "@/src/types/words";
import { shuffleArray } from "@/src/utils/shuffleArray";

import {
  completeDailyReviewSession,
  getDailyReviewWords,
  getLibraryWords,
  getQuickPracticeWords,
  getRecentlyLearnedWords,
  getRevisionHubStats,
} from "./services/revisionRpc.service";

export type RevisionMode = "list" | "flashcards";
export type { RevisionSortPrefs };

export type UseRevisionOptions = {
  variant?: "hub" | "library";
};

type RevisionProfile = { userId: string };

type RevisionState = {
  isLoading: boolean;
  profile: RevisionProfile | null;
  hubCounts: RevisionHubCounts;
  dailyRevisionCompletedToday: boolean;
  knownWords: VocabularyWord[];
  sortPrefs: RevisionSortPrefs;
  sessionPhase: RevisionSessionPhase;
  sessionConfig: RevisionSessionConfig | null;
  /** Pobieranie słów po starcie sesji z Revision Hub (przed wejściem w fiszki). */
  sessionFetchPending: boolean;
  mode: RevisionMode;
  flashDeck: VocabularyWord[];
  index: number;
  isFlipped: boolean;
};

function createInitialRevisionState(variant: "hub" | "library"): RevisionState {
  return {
    isLoading: true,
    profile: null,
    hubCounts: { daily: 0, recent: 0, all: 0 },
    dailyRevisionCompletedToday: false,
    knownWords: [],
    sortPrefs: DEFAULT_REVISION_SORT_PREFS,
    sessionPhase: variant === "hub" ? "hub" : "library",
    sessionConfig: null,
    sessionFetchPending: false,
    mode: "list",
    flashDeck: [],
    index: 0,
    isFlipped: false,
  };
}

function dedupeStringsMax(strings: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of strings) {
    const s = raw.trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function toVocabWord(d: WordDetails): VocabularyWord {
  const senses = d.senses ?? [];
  const first = senses[0];

  const glossCandidates: string[] = [];
  for (const s of senses) {
    const t = s.translation?.text?.trim() ?? "";
    if (t) glossCandidates.push(t);
  }
  const targetGlossParts = dedupeStringsMax(glossCandidates, 3);

  const exampleCandidates: string[] = [];
  const sortedSenses = [...senses].sort(
    (a, b) => (a.sense_order ?? 0) - (b.sense_order ?? 0),
  );
  for (const s of sortedSenses) {
    const exs = [...(s.translation?.examples ?? [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    for (const ex of exs) {
      const t = ex.text?.trim() ?? "";
      if (t) exampleCandidates.push(t);
    }
    if (exampleCandidates.length >= 3) break;
  }
  const examplePartsDeduped = dedupeStringsMax(exampleCandidates, 3);

  const primaryTarget =
    targetGlossParts[0] ?? first?.translation.text ?? "";
  const primaryExample =
    examplePartsDeduped[0] ??
    first?.translation.examples[0]?.text?.trim() ??
    "";

  return {
    id: d.word_id,
    sourceLanguageCode: d.target_language.code as any,
    targetLanguageCode: (first?.translation.native_language_id ?? "en") as any,
    sourceText: d.lemma,
    targetText: primaryTarget,
    targetGlossParts:
      targetGlossParts.length > 1 ? targetGlossParts : undefined,
    exampleSource: primaryExample,
    exampleParts:
      examplePartsDeduped.length > 1 ? examplePartsDeduped : undefined,
    exampleTarget: "",
    cefrLevel: (d.cefr.code ?? "A1") as any,
    knownAt: null,
    pronunciationText: d.ipa ?? undefined,
    audioUrl: null,
    partOfSpeech: first?.part_of_speech.name,
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

  const flashSessionStartedAtMsRef = useRef<number | null>(null);

  useEffect(() => {
    void loadRevisionSortPrefs().then((prefs) =>
      setState((prev) => ({ ...prev, sortPrefs: prefs })),
    );
  }, []);

  const fetchAllLibrary = useCallback(async (): Promise<VocabularyWord[]> => {
    const out: VocabularyWord[] = [];
    let offset = 0;
    const page = 50;
    for (let i = 0; i < 10; i += 1) {
      const res = await getLibraryWords({ limit: page, offset });
      for (const it of res.items) {
        out.push({
          id: it.word_id,
          sourceLanguageCode: "en" as any,
          targetLanguageCode: "en" as any,
          sourceText: it.lemma,
          targetText: "",
          exampleSource: "",
          exampleTarget: "",
          cefrLevel: (it.cefr_code ?? "A1") as any,
          knownAt: it.known_at ?? null,
        });
      }
      if (!res.hasMore) {
        break;
      }
      offset += page;
    }
    return out;
  }, []);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    const settings = await getUserProfileSettings();
    if (!settings) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        profile: null,
        knownWords: [],
        hubCounts: { daily: 0, recent: 0, all: 0 },
        dailyRevisionCompletedToday: false,
      }));
      return;
    }

    const [stats, library] = await Promise.all([
      getRevisionHubStats(),
      fetchAllLibrary(),
    ]);

    setState((prev) => ({
      ...prev,
      isLoading: false,
      profile: { userId: settings.user_id },
      hubCounts: {
        daily: stats.dailyRevision.dueCount,
        recent: stats.recentlyLearned.availableCount,
        all: stats.quickPractice.knownCount,
      },
      dailyRevisionCompletedToday: stats.dailyRevision.completedToday,
      knownWords: library,
    }));
  }, [fetchAllLibrary]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Refresh when user switches tabs / returns to this screen.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const setRevisionSortPrefs = useCallback((prefs: RevisionSortPrefs) => {
    setState((prev) => ({ ...prev, sortPrefs: prefs }));
    void saveRevisionSortPrefs(prefs);
  }, []);

  const activeCard = useMemo(() => {
    if (state.mode !== "flashcards") {
      return null;
    }
    return state.flashDeck[state.index] ?? null;
  }, [state.flashDeck, state.index, state.mode]);

  const openRevisionHub = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sessionPhase: "hub",
      sessionConfig: null,
      sessionFetchPending: false,
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
      sessionFetchPending: false,
      mode: "list",
      flashDeck: [],
      index: 0,
      isFlipped: false,
    }));
  }, []);

  const enterSession = useCallback((config: RevisionSessionConfig) => {
    void (async () => {
      setState((prev) => ({
        ...prev,
        sessionPhase: "session",
        sessionConfig: config,
        sessionFetchPending: true,
        mode: "list",
        flashDeck: [],
        index: 0,
        isFlipped: false,
        knownWords: [],
      }));

      let details: WordDetails[];
      if (config.kind === "daily") {
        details = await getDailyReviewWords();
      } else if (config.kind === "recent") {
        details = await getRecentlyLearnedWords();
      } else if (config.kind === "quick") {
        details = await getQuickPracticeWords(config.count);
      } else {
        details = [];
      }

      const words = details.map(toVocabWord);

      setState((prev) => {
        if (words.length === 0) {
          return {
            ...prev,
            knownWords: [],
            sessionFetchPending: false,
            mode: "list",
            flashDeck: [],
          };
        }
        if (variantRef.current === "hub" && prev.sessionPhase === "session") {
          flashSessionStartedAtMsRef.current = Date.now();
        }
        return {
          ...prev,
          knownWords: words,
          sessionFetchPending: false,
          mode: "flashcards",
          flashDeck: shuffleArray(words),
          index: 0,
          isFlipped: false,
        };
      });
    })();
  }, []);

  const exitSessionToHub = useCallback(() => {
    flashSessionStartedAtMsRef.current = null;
    setState((prev) => ({
      ...prev,
      sessionPhase: "hub",
      sessionConfig: null,
      sessionFetchPending: false,
      mode: "list",
      flashDeck: [],
      index: 0,
      isFlipped: false,
    }));
  }, []);

  /** Anulowanie fiszek z sesji Hub, bez zapisu powtórki / completeDailyReviewSession. */
  const cancelHubRevisionSession = useCallback(() => {
    flashSessionStartedAtMsRef.current = null;
    setState((prev) => ({
      ...prev,
      sessionPhase: "hub",
      sessionConfig: null,
      sessionFetchPending: false,
      mode: "list",
      flashDeck: [],
      index: 0,
      isFlipped: false,
      knownWords: [],
    }));
  }, []);

  const startFlashcards = useCallback(() => {
    setState((prev) => {
      if (prev.knownWords.length === 0) {
        return prev;
      }
      if (variantRef.current === "hub" && prev.sessionPhase === "session") {
        flashSessionStartedAtMsRef.current = Date.now();
      }
      return {
        ...prev,
        mode: "flashcards",
        flashDeck: shuffleArray(prev.knownWords),
        index: 0,
        isFlipped: false,
      };
    });
  }, []);

  const exitFlashcards = useCallback(() => {
    flashSessionStartedAtMsRef.current = null;
    setState((prev) => ({
      ...prev,
      mode: "list",
      flashDeck: [],
      index: 0,
      isFlipped: false,
    }));
  }, []);

  const completeRevisionSession = useCallback(
    async (): Promise<RevisionSessionCompletionStats | null> => {
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

      flashSessionStartedAtMsRef.current = null;

      if (prev.sessionConfig?.kind === "daily") {
        await completeDailyReviewSession(prev.flashDeck.map((w) => w.id));
      }

      setState((s) => ({
        ...s,
        sessionPhase: "hub",
        sessionConfig: null,
        sessionFetchPending: false,
        mode: "list",
        flashDeck: [],
        index: 0,
        isFlipped: false,
        knownWords: [],
      }));

      void refresh();
      return stats;
    },
    [refresh],
  );

  const flip = useCallback(() => {
    if (state.mode !== "flashcards" || !activeCard) {
      return;
    }
    setState((prev) => ({ ...prev, isFlipped: !prev.isFlipped }));
  }, [activeCard, state.mode]);

  const next = useCallback(() => {
    setState((prev) => {
      const len = prev.flashDeck.length;
      if (prev.mode !== "flashcards" || len === 0) {
        return prev;
      }
      return { ...prev, index: (prev.index + 1) % len, isFlipped: false };
    });
  }, []);

  const previous = useCallback(() => {
    setState((prev) => {
      const len = prev.flashDeck.length;
      if (prev.mode !== "flashcards" || len === 0) {
        return prev;
      }
      return { ...prev, index: Math.max(0, prev.index - 1), isFlipped: false };
    });
  }, []);

  const removeFromKnown = useCallback(async (_wordId: string) => {}, []);

  return {
    isLoading: state.isLoading,
    profile: state.profile,
    knownWords: state.knownWords,
    sortPrefs: state.sortPrefs,
    setRevisionSortPrefs,
    sessionPhase: state.sessionPhase,
    sessionConfig: state.sessionConfig,
    sessionFetchPending: state.sessionFetchPending,
    openRevisionHub,
    closeHubToLibrary,
    enterSession,
    exitSessionToHub,
    cancelHubRevisionSession,
    hubCounts: state.hubCounts,
    mode: state.mode,
    flashDeck: state.flashDeck,
    index: state.index,
    isFlipped: state.isFlipped,
    activeCard,
    startFlashcards,
    exitFlashcards,
    completeRevisionSession,
    dailyRevisionCompletedToday: state.dailyRevisionCompletedToday,
    flip,
    next,
    previous,
    removeFromKnown,
    refresh,
  };
}

