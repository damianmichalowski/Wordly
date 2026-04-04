import { completeDailyReviewSessionRpc } from "@/src/features/achievements/services/achievements.service";
import type { CompleteDailyReviewSessionResult } from "@/src/features/achievements/types/achievementEvents.types";
import { rpc } from "@/src/lib/supabase/rpc";

import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";

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
};

export type RevisionLibraryResponse = {
  items: { word_id: string; lemma: string; known_at: string | null; cefr_code: string }[];
  totalCount: number;
  hasMore: boolean;
};

export async function getRevisionHubStats(): Promise<RevisionHubStats> {
  const { data, error } = await rpc("get_revision_hub_stats");
  if (error) {
    throw new Error(`Failed to get revision hub stats: ${error.message}`);
  }
  return data as RevisionHubStats;
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

export async function getLibraryWords(input: {
  search?: string;
  cefrCodes?: string[];
  categoryCodes?: string[];
  sortKnownAt?: "asc" | "desc";
  limit?: number;
  offset?: number;
}): Promise<RevisionLibraryResponse> {
  const { data, error } = await rpc("get_library_words", {
    p_search: input.search,
    p_cefr_codes: input.cefrCodes,
    p_category_codes: input.categoryCodes,
    p_sort_known_at: input.sortKnownAt ?? "desc",
    p_limit: input.limit ?? 50,
    p_offset: input.offset ?? 0,
  });
  if (error) {
    throw new Error(`Failed to get library words: ${error.message}`);
  }
  return data as RevisionLibraryResponse;
}

