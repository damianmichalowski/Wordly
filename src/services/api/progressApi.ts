import { getSupabaseClient, hasSupabaseEnv } from '@/src/lib/supabase/client';
import type { Database } from '@/src/types/database';
import type { DailyWordState, UserWordProgress } from '@/src/types/progress';

export type ProgressMap = Record<string, UserWordProgress>;

type ProgressRow = Database['public']['Tables']['user_word_progress']['Row'];
type DailyRow = Database['public']['Tables']['daily_word_state']['Row'];

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

export async function fetchProgressMap(userId: string): Promise<ProgressMap> {
  if (!hasSupabaseEnv()) {
    return {};
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('user_word_progress').select('*').eq('user_id', userId);

  if (error) {
    console.warn('[progressApi] fetchProgressMap', error.message);
    return {};
  }

  const map: ProgressMap = {};
  for (const row of (data ?? []) as ProgressRow[]) {
    map[row.word_id] = rowToProgress(row);
  }
  return map;
}

export async function saveProgressMap(userId: string, map: ProgressMap): Promise<void> {
  if (!hasSupabaseEnv()) {
    return;
  }

  const entries = Object.values(map);
  if (entries.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();
  const payload = entries.map((p) => progressToInsert(userId, p));
  const { error } = await supabase.from('user_word_progress').upsert(payload, {
    onConflict: 'user_id,word_id',
  });

  if (error) {
    console.warn('[progressApi] saveProgressMap', error.message);
    throw new Error(error.message);
  }
}

/** Zapisuje pojedynczy wpis (np. jedna aktualizacja w pętli; użyj po mutacji mapy). */
export async function upsertSingleProgress(userId: string, progress: UserWordProgress): Promise<void> {
  await saveProgressMap(userId, { [progress.wordId]: progress });
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

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('daily_word_state').select('*').eq('user_id', userId).maybeSingle();

  if (error) {
    console.warn('[progressApi] fetchDailyWordState', error.message);
    return emptyDailyState();
  }

  return dailyRowToState((data ?? null) as DailyRow | null);
}

export async function saveDailyWordState(userId: string, state: DailyWordState): Promise<void> {
  if (!hasSupabaseEnv()) {
    return;
  }

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from('daily_word_state').upsert(
    {
      user_id: userId,
      active_word_id: state.activeWordId,
      active_date: state.activeDate,
      state_version: state.stateVersion,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    console.warn('[progressApi] saveDailyWordState', error.message);
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
