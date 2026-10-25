import { completeDailyReviewSessionRpc } from "@/src/features/achievements/services/achievements.service";
import type { CompleteDailyReviewSessionResult } from "@/src/features/achievements/types/achievementEvents.types";
import { rpc } from "@/src/lib/supabase/rpc";

import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";
import type {
  CompleteRevisionSessionResult,
  LibraryCollectionFilter,
  RevisionDashboardStats,
  RevisionSessionAnswer,
  StartRevisionSessionResult,
} from "@/src/types/revisionTracking";

export type { CompleteDailyReviewSessionResult };

export type RevisionHubStats = {
  dailyRevision: {
    dueCount: number;
    maxSessionSize: number;
    completedToday: boolean;
  };
  quickPractice: {
    knownCount: number;
    canStart5: boolean;
    canStart10: boolean;
    canStart20: boolean;
  };
  recentlyLearned: {
    availableCount: number;
  };
  difficultWords: {
    availableCount: number;
  };
};

export type RevisionLibraryItem = {
  word_id: string;
  lemma: string;
  known_at: string | null;
  cefr_code: string;
  next_review_at: string | null;
  interval_days: number;
  is_difficult: boolean;
};

export type RevisionLibraryResponse = {
  items: RevisionLibraryItem[];
  totalCount: number;
  hasMore: boolean;
};

export async function getRevisionHubStats(): Promise<RevisionHubStats> {
  const { data, error } = await rpc("get_revision_hub_stats");
  if (error) {
    throw new Error(`Failed to get revision hub stats: ${error.message}`);
  }
  const stats = data as RevisionHubStats;
  return {
    ...stats,
    difficultWords: stats.difficultWords ?? { availableCount: 0 },
  };
}

export async function getDailyReviewWords(): Promise<WordDetails[]> {
  const { data, error } = await rpc("get_daily_review_words");
  if (error) {
    throw new Error(`Failed to get daily review words: ${error.message}`);
  }
  return (data ?? []) as WordDetails[];
}

export async function completeDailyReviewSession(
  wordIds: string[],
): Promise<CompleteDailyReviewSessionResult> {
  return completeDailyReviewSessionRpc(wordIds);
}

export async function getQuickPracticeWords(limit: 5 | 10 | 20): Promise<WordDetails[]> {
  const { data, error } = await rpc("get_quick_practice_words", {
    p_limit: limit,
  });
  if (error) {
    throw new Error(`Failed to get quick practice words: ${error.message}`);
  }
  return (data ?? []) as WordDetails[];
}

export async function getRecentlyLearnedWords(): Promise<WordDetails[]> {
  const { data, error } = await rpc("get_recently_learned_words");
  if (error) {
    throw new Error(`Failed to get recently learned words: ${error.message}`);
  }
  return (data ?? []) as WordDetails[];
}

export async function getDifficultWords(
  limit?: number,
): Promise<WordDetails[]> {
  const { data, error } = await rpc("get_difficult_words", {
    p_limit: limit ?? null,
  });
  if (error) {
    throw new Error(`Failed to get difficult words: ${error.message}`);
  }
  return (data ?? []) as WordDetails[];
}

export async function getLibraryWords(input: {
  search?: string;
  cefrCodes?: string[];
  categoryCodes?: string[];
  sortKnownAt?: "asc" | "desc";
  limit?: number;
  offset?: number;
  collection?: LibraryCollectionFilter;
}): Promise<RevisionLibraryResponse> {
  const { data, error } = await rpc("get_library_words", {
    p_search: input.search,
    p_cefr_codes: input.cefrCodes,
    p_category_codes: input.categoryCodes,
    p_sort_known_at: input.sortKnownAt ?? "desc",
    p_limit: input.limit ?? 50,
    p_offset: input.offset ?? 0,
    p_collection: input.collection ?? null,
  });
  if (error) {
    throw new Error(`Failed to get library words: ${error.message}`);
  }
  return data as RevisionLibraryResponse;
}

// ---------------------------------------------------------------------------
// Session tracking RPCs
// ---------------------------------------------------------------------------

export async function startRevisionSessionRpc(
  mode: string,
  totalWords: number,
): Promise<StartRevisionSessionResult> {
  const { data, error } = await rpc("start_revision_session", {
    p_mode: mode,
    p_total_words: totalWords,
  });
  if (error) {
    throw new Error(`start_revision_session failed: ${error.message}`);
  }
  return data as StartRevisionSessionResult;
}

export async function completeRevisionSessionRpc(
  sessionId: string,
  answers: RevisionSessionAnswer[],
  durationSeconds: number,
  applySrs: boolean,
): Promise<CompleteRevisionSessionResult> {
  const { data, error } = await rpc("complete_revision_session", {
    p_session_id: sessionId,
    p_answers: answers,
    p_duration_seconds: durationSeconds,
    p_apply_srs: applySrs,
  });
  if (error) {
    throw new Error(`complete_revision_session failed: ${error.message}`);
  }
  return data as CompleteRevisionSessionResult;
}

export async function getRevisionDashboardStats(): Promise<RevisionDashboardStats> {
  const { data, error } = await rpc("get_revision_dashboard_stats");
  if (error) {
    throw new Error(`get_revision_dashboard_stats failed: ${error.message}`);
  }
  return data as RevisionDashboardStats;
}

