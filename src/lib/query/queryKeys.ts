/**
 * Stable React Query keys — one conceptual domain per key family.
 * Use factories for parameterized keys (word id, etc.).
 */
export const queryKeys = {
  profile: {
    all: ["profile"] as const,
    settings: ["profile", "settings"] as const,
    summary: ["profile", "summary"] as const,
  },
  learning: {
    trackProgress: ["learning", "trackProgress"] as const,
    optionsProgress: ["learning", "optionsProgress"] as const,
  },
  onboarding: {
    options: ["onboarding", "options"] as const,
  },
  dailyWord: {
    /** Prefix: invalidates current + read-only preview, etc. */
    all: ["dailyWord"] as const,
    current: ["dailyWord", "current"] as const,
    readOnlyDetails: ["dailyWord", "readOnlyDetails"] as const,
  },
  words: {
    detail: (wordId: string) => ["words", "detail", wordId] as const,
  },
  revision: {
    hubStats: ["revision", "hubStats"] as const,
    /** Recently Learned deck: refetch when `recentlyLearned.availableCount` from hub changes. */
    recentlyLearnedDeck: (availableCount: number, sessionCount: number) =>
      ["revision", "recentlyLearnedDeck", availableCount, sessionCount] as const,
    /** Last successful quick practice fetch per size — offline replay. */
    quickPracticeDeck: (size: 5 | 10 | 20) =>
      ["revision", "quickPracticeDeck", size] as const,
    difficultWordsDeck: (limit: number) =>
      ["revision", "difficultWordsDeck", limit] as const,
    dashboardStats: ["revision", "dashboardStats"] as const,
  },
  library: {
    allKnownWords: ["library", "allKnownWords"] as const,
    overview: ["library", "overview"] as const,
  },
  achievements: {
    list: ["achievements", "list"] as const,
  },
} as const;
