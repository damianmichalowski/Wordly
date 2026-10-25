import { rpc } from "@/src/lib/supabase/rpc";

export type SetWordDifficultResult = {
  userId: string;
  wordId: string;
  isDifficult: boolean | null;
  difficultMarkedAt: string | null;
  difficultDontKnowCounter: number;
  status: string;
};

export type RecordWordDifficultDontKnowResult = {
  userId: string;
  wordId: string;
  difficultDontKnowCounter: number;
  isDifficult: boolean | null;
  difficultMarkedAt: string | null;
  status: string;
};

export async function setWordDifficult(
  wordId: string,
  isDifficult: boolean,
): Promise<SetWordDifficultResult> {
  const { data, error } = await rpc("set_word_difficult", {
    p_word_id: wordId,
    p_is_difficult: isDifficult,
  });

  if (error) {
    throw new Error(`Failed to set word difficult: ${error.message}`);
  }

  const row = data?.[0];
  if (!row) {
    throw new Error("set_word_difficult returned no row");
  }

  return {
    userId: row.user_id,
    wordId: row.word_id,
    isDifficult: row.is_difficult,
    difficultMarkedAt: row.difficult_marked_at,
    difficultDontKnowCounter: row.difficult_dont_know_counter ?? 0,
    status: row.status,
  };
}

export async function recordWordDifficultDontKnow(
  wordId: string,
): Promise<RecordWordDifficultDontKnowResult> {
  const { data, error } = await rpc("record_word_difficult_dont_know", {
    p_word_id: wordId,
  });

  if (error) {
    throw new Error(
      `Failed to record difficult don't know: ${error.message}`,
    );
  }

  const row = data?.[0];
  if (!row) {
    throw new Error("record_word_difficult_dont_know returned no row");
  }

  return {
    userId: row.user_id,
    wordId: row.word_id,
    difficultDontKnowCounter: row.difficult_dont_know_counter,
    isDifficult: row.is_difficult,
    difficultMarkedAt: row.difficult_marked_at,
    status: row.status,
  };
}

export async function setWordDifficultDontKnowCounter(
  wordId: string,
  counter: number,
): Promise<{ wordId: string; difficultDontKnowCounter: number; isDifficult: boolean | null }> {
  const { data, error } = await rpc("set_word_difficult_dont_know_counter", {
    p_word_id: wordId,
    p_counter: counter,
  });

  if (error) {
    throw new Error(
      `Failed to set difficult don't know counter: ${error.message}`,
    );
  }

  const row = data?.[0];
  if (!row) {
    throw new Error("set_word_difficult_dont_know_counter returned no row");
  }

  return {
    wordId: row.word_id,
    difficultDontKnowCounter: row.difficult_dont_know_counter,
    isDifficult: row.is_difficult,
  };
}

export type SetWordDifficultCorrectStreakResult = {
  userId: string;
  wordId: string;
  difficultCorrectStreak: number;
  isDifficult: boolean | null;
  status: string;
};

export async function setWordDifficultCorrectStreak(
  wordId: string,
  streak: number,
): Promise<SetWordDifficultCorrectStreakResult> {
  const { data, error } = await rpc("set_word_difficult_correct_streak", {
    p_word_id: wordId,
    p_streak: streak,
  });

  if (error) {
    throw new Error(
      `Failed to set difficult correct streak: ${error.message}`,
    );
  }

  const row = data?.[0];
  if (!row) {
    throw new Error("set_word_difficult_correct_streak returned no row");
  }

  return {
    userId: row.user_id,
    wordId: row.word_id,
    difficultCorrectStreak: row.difficult_correct_streak,
    isDifficult: row.is_difficult,
    status: row.status,
  };
}
