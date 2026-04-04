import type { AchievementEventPayload } from "@/src/features/achievements/types/achievementEvents.types";
import { parseAchievementEventPayloadArray } from "@/src/features/achievements/utils/parseAchievementRpcJson";
import { rpc } from "@/src/lib/supabase/rpc";

import type { WordDetails } from "../../word-details/types/wordDetails.types";
import { getWordDetails } from "../../word-details/services/wordDetails.service";
import type {
  DailyWordAssignment,
  DailyWordResult,
} from "../types/dailyWord.types";

/**
 * Creates/returns today’s assignment when the track has a candidate word.
 * Returns `null` when there is nothing to assign (empty domain — not a transport error).
 */
export async function getOrCreateDailyWord(): Promise<DailyWordAssignment | null> {
  const { data, error } = await rpc("get_or_create_daily_word");

  if (error) {
    throw new Error(`Failed to get or create daily word: ${error.message}`);
  }

  const firstRow = data?.[0];

  if (!firstRow) {
    return null;
  }

  return firstRow;
}

export async function getDailyWordWithDetails(): Promise<DailyWordResult | null> {
  const assignment = await getOrCreateDailyWord();
  if (!assignment) {
    return null;
  }
  const details = await getWordDetails(assignment.word_id);

  return {
    assignment,
    details,
  };
}

/**
 * Read-only: today’s word details if a row already exists in `user_daily_word`.
 * Does **not** create an assignment (safe for Settings widget preview without side effects).
 * For the home card, use {@link getDailyWordWithDetails} so the word is created when needed.
 */
export async function getDailyWordDetailsReadOnly(): Promise<WordDetails | null> {
  const { data, error } = await rpc("get_daily_word_details");

  if (error) {
    throw new Error(`Failed to get daily word details: ${error.message}`);
  }

  if (data == null) {
    return null;
  }

  return data as WordDetails;
}

export type MarkDailyWordAsKnownResult = {
  assignment: DailyWordAssignment | null;
  achievementEvents: AchievementEventPayload[];
};

export async function markDailyWordAsKnown(
  wordId: string,
): Promise<MarkDailyWordAsKnownResult> {
  const { data, error } = await rpc("mark_word_known_and_advance_daily_word", {
    p_word_id: wordId,
  });

  if (error) {
    throw new Error(`Failed to mark word as known: ${error.message}`);
  }

  const firstRow = data?.[0] as
    | {
        daily_word_id: string | null;
        word_id: string | null;
        day_date: string | null;
        achievement_events?: unknown;
      }
    | undefined;

  if (!firstRow) {
    return { assignment: null, achievementEvents: [] };
  }

  const achievementEvents = parseAchievementEventPayloadArray(
    firstRow.achievement_events,
  );

  if (!firstRow.word_id) {
    return { assignment: null, achievementEvents };
  }

  return {
    assignment: {
      daily_word_id: firstRow.daily_word_id ?? "",
      word_id: firstRow.word_id,
      day_date: firstRow.day_date ?? "",
    },
    achievementEvents,
  };
}
