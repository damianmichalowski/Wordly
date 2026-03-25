import { getSupabaseClient, hasSupabaseEnv } from '@/src/lib/supabase/client';
import { traceSupabase } from '@/src/utils/supabaseTrace';
import type { Database } from '@/src/types/database';
import type { DailyWordState, UserWordProgress } from '@/src/types/progress';

export type ProgressMap = Record<string, UserWordProgress>;

type ProgressRow = Database['public']['Tables']['user_word_progress']['Row'];
type DailyRow = Database['public']['Tables']['daily_word_state']['Row'];

/** Bez `difficulty_score` dopóki kolumna nie istnieje w Supabase (błąd 42703). */
const USER_WORD_PROGRESS_COLUMNS =
  'word_id, status, first_seen_at, marked_known_at, skipped_at, last_reviewed_at, next_review_at, review_count' as const;

const DAILY_WORD_STATE_COLUMNS =
  'active_word_id, active_date, updated_at, state_version' as const;

const emptyDailyState = (): DailyWordState => ({
  activeWordId: null,
  activeDate: null,
  updatedAt: new Date(0).toISOString(),
  stateVersion: 0,
});

function rowToProgress(row: ProgressRow): UserWordProgress {
  const r = row as ProgressRow & { difficulty_score?: number | null };
  return {
    wordId: row.word_id,
    status: row.status as UserWordProgress['status'],
    firstSeenAt: row.first_seen_at ?? new Date().toISOString(),
    markedKnownAt: row.marked_known_at ?? undefined,
    skippedAt: row.skipped_at ?? undefined,
    lastReviewedAt: row.last_reviewed_at ?? undefined,
    nextReviewAt: row.next_review_at ?? undefined,
    reviewCount: row.review_count,
    difficultyScore: r.difficulty_score ?? 0,
  };
}

/** Bez `difficulty_score` w body — przy braku kolumny w DB PostgREST zgłasza błąd schema cache. */
function progressToInsert(userId: string, p: UserWordProgress): Database['public']['Tables']['user_word_progress']['Insert'] {
  return {
    user_id: userId,
    word_id: p.wordId,
    status: p.status,
    first_seen_at: p.firstSeenAt,
    marked_known_at: p.markedKnownAt ?? null,
    last_reviewed_at: p.lastReviewedAt ?? null,
    next_review_at: p.nextReviewAt ?? null,
    review_count: p.reviewCount,
    skipped_at: p.skippedAt ?? null,
  };
}

/** Deduplicate concurrent selects for the same user (StrictMode / parallel hooks). */
const inFlightProgressFetch = new Map<string, Promise<ProgressMap>>();

async function fetchProgressMapUncached(userId: string): Promise<ProgressMap> {
  if (!hasSupabaseEnv()) {
    return {};
  }

  const { data, error } = await traceSupabase(
    'user_word_progress.select (by user_id)',
    async () => {
      const supabase = getSupabaseClient();
      return supabase
        .from('user_word_progress')
        .select(USER_WORD_PROGRESS_COLUMNS)
        .eq('user_id', userId);
    },
  );

  if (error) {
    return {};
  }

  const map: ProgressMap = {};
  for (const row of (data ?? []) as ProgressRow[]) {
    map[row.word_id] = rowToProgress(row);
  }
  return map;
}

export async function fetchProgressMap(userId: string): Promise<ProgressMap> {
  const existing = inFlightProgressFetch.get(userId);
  if (existing) {
    return existing;
  }
  const p = fetchProgressMapUncached(userId).finally(() => {
    inFlightProgressFetch.delete(userId);
  });
  inFlightProgressFetch.set(userId, p);
  return p;
}

/** Dedupe concurrent bucket-scoped fetches (same user + same word-id set). */
const inFlightProgressForWordIds = new Map<string, Promise<ProgressMap>>();

function progressForWordIdsKey(userId: string, wordIds: string[]): string {
  return `${userId}|${[...new Set(wordIds)].sort().join('\u0001')}`;
}

/**
 * Progress rows only for the given word ids (e.g. daily candidate bucket).
 * Avoids loading the full `user_word_progress` table when resolving the daily queue.
 */
async function fetchProgressMapForWordIdsUncached(
  userId: string,
  wordIds: string[],
): Promise<ProgressMap> {
  if (!hasSupabaseEnv() || wordIds.length === 0) {
    return {};
  }

  const unique = [...new Set(wordIds)];
  const map: ProgressMap = {};
  const chunkSize = 120;

  for (let i = 0; i < unique.length; i += chunkSize) {
    const batch = unique.slice(i, i + chunkSize);
    const { data, error } = await traceSupabase(
      `user_word_progress.select (by word_ids, ${batch.length} ids)`,
      async () => {
        const supabase = getSupabaseClient();
        return supabase
          .from('user_word_progress')
          .select(USER_WORD_PROGRESS_COLUMNS)
          .eq('user_id', userId)
          .in('word_id', batch);
      },
    );

    if (error) {
      continue;
    }

    for (const row of (data ?? []) as ProgressRow[]) {
      map[row.word_id] = rowToProgress(row);
    }
  }

  return map;
}

export async function fetchProgressMapForWordIds(
  userId: string,
  wordIds: string[],
): Promise<ProgressMap> {
  if (!hasSupabaseEnv() || wordIds.length === 0) {
    return {};
  }
  const unique = [...new Set(wordIds)];
  const key = progressForWordIdsKey(userId, unique);
  const existing = inFlightProgressForWordIds.get(key);
  if (existing) {
    return existing;
  }
  const p = fetchProgressMapForWordIdsUncached(userId, unique).finally(() => {
    inFlightProgressForWordIds.delete(key);
  });
  inFlightProgressForWordIds.set(key, p);
  return p;
}

export async function saveProgressMap(userId: string, map: ProgressMap): Promise<void> {
  if (!hasSupabaseEnv()) {
    return;
  }

  const entries = Object.values(map);
  if (entries.length === 0) {
    return;
  }

  const payload = entries.map((p) => progressToInsert(userId, p));
  const { error } = await traceSupabase(
    `user_word_progress.upsert (${entries.length} rows)`,
    async () => {
      const supabase = getSupabaseClient();
      return supabase.from('user_word_progress').upsert(payload, {
        onConflict: 'user_id,word_id',
      });
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

/** Minimal single-row upsert (do not pass the full progress map). */
export async function upsertSingleProgress(
  userId: string,
  progress: UserWordProgress,
): Promise<void> {
  if (!hasSupabaseEnv()) {
    return;
  }

  const payload = progressToInsert(userId, progress);
  const { error } = await traceSupabase(
    'user_word_progress.upsert (1 row)',
    async () => {
      const supabase = getSupabaseClient();
      return supabase.from('user_word_progress').upsert([payload], {
        onConflict: 'user_id,word_id',
      });
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export function dailyRowToState(row: DailyRow | null): DailyWordState {
  if (!row) {
    return emptyDailyState();
  }

  const activeDate =
    row.active_date === null || row.active_date === undefined
      ? null
      : typeof row.active_date === 'string'
        ? row.active_date.slice(0, 10)
        : String(row.active_date).slice(0, 10);

  return {
    activeWordId: row.active_word_id,
    activeDate,
    updatedAt: row.updated_at,
    stateVersion: Number(row.state_version),
  };
}

export async function fetchDailyWordState(userId: string): Promise<DailyWordState> {
  if (!hasSupabaseEnv()) {
    return emptyDailyState();
  }

  const { data, error } = await traceSupabase(
    'daily_word_state.select (maybeSingle)',
    async () => {
      const supabase = getSupabaseClient();
      return supabase
        .from('daily_word_state')
        .select(DAILY_WORD_STATE_COLUMNS)
        .eq('user_id', userId)
        .maybeSingle();
    },
  );

  if (error) {
    return emptyDailyState();
  }

  return dailyRowToState((data ?? null) as DailyRow | null);
}

export async function saveDailyWordState(userId: string, state: DailyWordState): Promise<void> {
  if (!hasSupabaseEnv()) {
    return;
  }

  const now = new Date().toISOString();
  const { error } = await traceSupabase('daily_word_state.upsert', async () => {
    const supabase = getSupabaseClient();
    return supabase.from('daily_word_state').upsert(
      {
        user_id: userId,
        active_word_id: state.activeWordId,
        active_date: state.activeDate,
        state_version: state.stateVersion,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    );
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function resetDailyWordState(userId: string): Promise<void> {
  const now = new Date().toISOString();
  await saveDailyWordState(userId, {
    activeWordId: null,
    activeDate: null,
    updatedAt: now,
    stateVersion: Date.now(),
  });
}
