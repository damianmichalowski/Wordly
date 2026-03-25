export const storageKeys = {
  onboardingCompleted: 'wordly.onboarding.completed',
  userProfile: 'wordly.user.profile',
  /** Cached daily word snapshot (instant home screen). */
  currentWordSnapshot: (profileKey: string) =>
    `wordly.currentWord.snapshot.v1.${profileKey}`,
  /** Minimal vocabulary candidate list for progression (large list, TTL). */
  vocabularyCandidates: (profileKey: string) =>
    `wordly.vocab.candidates.v1.${profileKey}`,
  /** Known words bundle for revision (local-first). */
  knownWordsBundle: (userId: string) => `wordly.knownWords.bundle.v1.${userId}`,
} as const;
