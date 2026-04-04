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
  },
  library: {
    allKnownWords: ["library", "allKnownWords"] as const,
  },
  achievements: {
    list: ["achievements", "list"] as const,
  },
} as const;
