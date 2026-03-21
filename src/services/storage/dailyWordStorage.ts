import { storageKeys } from '@/src/constants/storageKeys';
import { getItem, setItem } from '@/src/services/storage/kvStorage';
import type { DailyWordState, UserWordProgress } from '@/src/types/progress';

const emptyState: DailyWordState = {
  activeWordId: null,
  activeDate: null,
  updatedAt: new Date(0).toISOString(),
  stateVersion: 0,
};

export type ProgressMap = Record<string, UserWordProgress>;

export async function readProgressMap(): Promise<ProgressMap> {
  const raw = await getItem(storageKeys.userWordProgress);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as ProgressMap;
  } catch {
    return {};
  }
}

export async function writeProgressMap(progress: ProgressMap): Promise<void> {
  await setItem(storageKeys.userWordProgress, JSON.stringify(progress));
}

export async function readDailyWordState(): Promise<DailyWordState> {
  const raw = await getItem(storageKeys.dailyWordState);
  if (!raw) {
    return emptyState;
  }

  try {
    return JSON.parse(raw) as DailyWordState;
  } catch {
    return emptyState;
  }
}

export async function writeDailyWordState(state: DailyWordState): Promise<void> {
  await setItem(storageKeys.dailyWordState, JSON.stringify(state));
}

export async function resetDailyWordState(): Promise<void> {
  const now = new Date().toISOString();
  await writeDailyWordState({
    activeWordId: null,
    activeDate: null,
    updatedAt: now,
    stateVersion: Date.now(),
  });
}
