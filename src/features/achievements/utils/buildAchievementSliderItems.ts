import type { UserAchievementRow } from "../services/achievements.service";

export type AchievementSliderItem =
  | { kind: "unlocked"; row: UserAchievementRow }
  | { kind: "locked"; row: UserAchievementRow };

function sortUnlockedNewestFirst(rows: UserAchievementRow[]): UserAchievementRow[] {
  return [...rows].sort((a, b) => {
    const ta = a.unlockedAt ? new Date(a.unlockedAt).getTime() : 0;
    const tb = b.unlockedAt ? new Date(b.unlockedAt).getTime() : 0;
    return tb - ta;
  });
}

function sortLockedByProgress(rows: UserAchievementRow[]): UserAchievementRow[] {
  return [...rows].sort(
    (a, b) =>
      a.definition.sortOrder - b.definition.sortOrder ||
      a.definition.threshold - b.definition.threshold,
  );
}

/**
 * Preview strip (max 5): 0 unlocked → 5 locked; &lt;5 unlocked → unlocked + next locked;
 * ≥5 unlocked with remaining locked → 4 newest unlocked + next locked; all unlocked → 5 newest.
 */
export function buildAchievementSliderItems(
  all: UserAchievementRow[],
  maxItems = 5,
): AchievementSliderItem[] {
  const unlocked = all.filter((r) => r.unlocked);
  const locked = sortLockedByProgress(all.filter((r) => !r.unlocked));
  const uDesc = sortUnlockedNewestFirst(unlocked);

  if (unlocked.length === 0) {
    return locked.slice(0, maxItems).map((row) => ({ kind: "locked", row }));
  }

  if (unlocked.length < maxItems) {
    const uPart = uDesc.map((row) => ({ kind: "unlocked" as const, row }));
    const need = maxItems - uPart.length;
    const lPart = locked
      .slice(0, need)
      .map((row) => ({ kind: "locked" as const, row }));
    return [...uPart, ...lPart];
  }

  if (locked.length === 0) {
    return uDesc
      .slice(0, maxItems)
      .map((row) => ({ kind: "unlocked" as const, row }));
  }

  const newest4 = uDesc.slice(0, 4).map((row) => ({ kind: "unlocked" as const, row }));
  const nextLocked = locked[0];
  if (!nextLocked) {
    return uDesc
      .slice(0, maxItems)
      .map((row) => ({ kind: "unlocked" as const, row }));
  }
  return [...newest4, { kind: "locked", row: nextLocked }];
}
