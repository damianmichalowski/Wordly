/** Answer payload sent to complete_revision_session RPC. */
export type RevisionSessionAnswer = {
  word_id: string;
  answer_result: "correct" | "wrong" | "skipped";
  response_time_ms: number | null;
};

/** Response from start_revision_session RPC. */
export type StartRevisionSessionResult = {
  sessionId: string;
  mode: string;
  startedAt: string;
  totalWords: number;
};

/** Response from complete_revision_session RPC. */
export type CompleteRevisionSessionResult = {
  success: boolean;
  sessionId?: string;
  totalWords?: number;
  correctCount?: number;
  wrongCount?: number;
  accuracy?: number;
  durationSeconds?: number | null;
  error?: string;
};

// ---------------------------------------------------------------------------
// Revision Dashboard Stats
// ---------------------------------------------------------------------------

export type RevisionDashboardToday = {
  reviewedWords: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  durationSeconds: number;
};

export type RevisionDashboardWeek = {
  reviewedWords: number;
  sessionsCount: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  durationSeconds: number;
  improvementPercent: number | null;
};

export type RevisionDashboardAllTime = {
  knownWords: number;
  reviewedWords: number;
  sessionsCount: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  bestAccuracy: number | null;
  bestSessionWords: number | null;
  bestTimeSeconds: number | null;
};

export type RevisionDashboardMemory = {
  dueToday: number;
  dueSoon: number;
  strongWords: number;
  needAttention: number;
};

export type RevisionDashboardStats = {
  today: RevisionDashboardToday;
  week: RevisionDashboardWeek;
  allTime: RevisionDashboardAllTime;
  memory: RevisionDashboardMemory;
};

// ---------------------------------------------------------------------------
// Library Overview
// ---------------------------------------------------------------------------

export type LibraryCefrProgress = {
  code: string;
  known: number;
  target: number;
};

export type LibraryCollectionCounts = {
  recentlyLearned: number;
  dueSoon: number;
  needAttention: number;
  strongMemory: number;
};

export type LibraryOverview = {
  knownWords: number;
  reviewedThisWeek: number;
  byLevel: LibraryCefrProgress[];
  collections: LibraryCollectionCounts;
};

/** Backend-backed collection filter for get_library_words p_collection. */
export type LibraryCollectionFilter =
  | "all"
  | "recently_learned"
  | "due_soon"
  | "need_attention"
  | "strong_memory";
