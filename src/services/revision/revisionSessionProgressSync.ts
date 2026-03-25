import { AppState, type AppStateStatus } from "react-native";

import { saveProgressMap } from "@/src/services/api/progressApi";
import { LogTag, logger } from "@/src/utils/logger";
import type { UserWordProgress } from "@/src/types/progress";

const pendingByUser = new Map<string, Map<string, UserWordProgress>>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 2000;
const AUTO_FLUSH_COUNT = 8;

function pendingFor(userId: string): Map<string, UserWordProgress> {
  let m = pendingByUser.get(userId);
  if (!m) {
    m = new Map();
    pendingByUser.set(userId, m);
  }
  return m;
}

/**
 * Queues SRS progress rows for a single batch upsert. Local cache is already
 * updated in {@link markWordReviewed}; this only syncs to Supabase.
 */
export function queueReviewProgressForRemoteSync(
  userId: string,
  progress: UserWordProgress,
): void {
  const m = pendingFor(userId);
  m.set(progress.wordId, progress);

  if (m.size >= AUTO_FLUSH_COUNT) {
    void flushRevisionReviewProgressBatches(userId);
    return;
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flushRevisionReviewProgressBatches(userId);
  }, DEBOUNCE_MS);
}

export async function flushRevisionReviewProgressBatches(
  userId?: string,
): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  const userIds = userId ? [userId] : [...pendingByUser.keys()];

  for (const uid of userIds) {
    const m = pendingByUser.get(uid);
    if (!m || m.size === 0) {
      continue;
    }

    const map: Record<string, UserWordProgress> = {};
    for (const [id, row] of m) {
      map[id] = row;
    }
    m.clear();

    const n = Object.keys(map).length;
    logger.info(LogTag.REVISION_SESSION, `Progress batch sync started (${n} rows)`);
    try {
      await saveProgressMap(uid, map);
      logger.info(LogTag.REVISION_SESSION, "Progress batch sync success");
    } catch (e) {
      logger.warn(
        LogTag.REVISION_SESSION,
        "Progress batch sync failed; re-queued for retry",
        e,
      );
      const retry = pendingFor(uid);
      for (const [id, row] of Object.entries(map)) {
        retry.set(id, row);
      }
    }
  }
}

let appListener: ReturnType<typeof AppState.addEventListener> | null = null;

/** Flush pending review writes when app leaves foreground (best-effort durability). */
export function ensureRevisionProgressFlushOnBackground(): void {
  if (appListener) {
    return;
  }
  appListener = AppState.addEventListener("change", (next: AppStateStatus) => {
    if (next === "background" || next === "inactive") {
      void flushRevisionReviewProgressBatches();
    }
  });
}
