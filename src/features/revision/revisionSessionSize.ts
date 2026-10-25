export const REVISION_SESSION_SIZES = [5, 10, 20] as const;

export type RevisionSessionSize = (typeof REVISION_SESSION_SIZES)[number];

/** Which 5 / 10 / 20 tiles to show for a pool of available words. */
export function getRevisionSessionSizeOptions(
  availableCount: number,
): RevisionSessionSize[] {
  if (availableCount >= 20) {
    return [5, 10, 20];
  }
  if (availableCount >= 10) {
    return [5, 10];
  }
  if (availableCount >= 5) {
    return [5];
  }
  return [];
}

export function defaultRevisionSessionSize(
  availableCount: number,
): RevisionSessionSize | number {
  if (availableCount < 5) {
    return Math.max(0, availableCount);
  }
  if (availableCount >= 20) {
    return 20;
  }
  if (availableCount >= 10) {
    return 10;
  }
  return 5;
}

export function revisionSessionSizeEnabled(
  availableCount: number,
  size: RevisionSessionSize,
): boolean {
  return availableCount >= size;
}

export function resolveRevisionSessionCount(
  availableCount: number,
  selected: RevisionSessionSize,
): number {
  if (availableCount < 5) {
    return availableCount;
  }
  return Math.min(selected, availableCount);
}
