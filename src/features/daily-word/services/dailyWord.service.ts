import { rpc } from "@/src/lib/supabase/rpc";

import { getWordDetails } from "../../word-details/services/wordDetails.service";
import type {
    DailyWordAssignment,
    DailyWordResult,
} from "../types/dailyWord.types";

export async function getOrCreateDailyWord(): Promise<DailyWordAssignment> {
  const { data, error } = await rpc("get_or_create_daily_word");

  if (error) {
    throw new Error(`Failed to get or create daily word: ${error.message}`);
  }

  const firstRow = data?.[0];

  if (!firstRow) {
    throw new Error("Daily word was not returned");
  }

  return firstRow;
}

export async function getDailyWordWithDetails(): Promise<DailyWordResult> {
  const assignment = await getOrCreateDailyWord();
  const details = await getWordDetails(assignment.word_id);

  return {
    assignment,
    details,
  };
}

export async function markDailyWordAsKnown(wordId: string) {
  const { data, error } = await rpc("mark_word_known_and_advance_daily_word", {
    p_word_id: wordId,
  });

  if (error) {
    throw new Error(`Failed to mark word as known: ${error.message}`);
  }

  const firstRow = data?.[0] ?? null;

  // When there are no more candidate words, the RPC returns 0 rows.
  return firstRow as DailyWordAssignment | null;
}
