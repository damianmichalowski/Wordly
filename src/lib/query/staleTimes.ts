/**
 * Recommended staleTime (ms) per domain — tuned for mobile + Supabase RPCs.
 * Global QueryClient defaults apply when not overridden.
 */
export const staleTimes = {
  /** User-editable; invalidate on save via mutation. */
  profileSettings: 5 * 60_000,
  profileSummary: 2 * 60_000,
  /** Shifts when a word is marked known; keep relatively short. */
  learningTrackProgress: 60_000,
  learningOptionsProgress: 5 * 60_000,
  /** Rarely changes. */
  onboardingOptions: 30 * 60_000,
  /** Assignment can change after mark known; keep moderate. */
  dailyWordCurrent: 45_000,
  /** Settings widget: read-only snapshot; cheap to cache longer. */
  dailyWordReadOnlyDetails: 6 * 60_000,
  /** Hub tiles / counts. */
  revisionHubStats: 90_000,
  /** Full library list — expensive; cache longer, invalidate on known-word changes. */
  libraryAllKnownWords: 3 * 60_000,
  /** Trophies list. */
  achievementsList: 5 * 60_000,
  /** Word detail screen / shared lemma payload. */
  wordDetails: 10 * 60_000,
} as const;
