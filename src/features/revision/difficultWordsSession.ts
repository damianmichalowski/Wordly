export function clampDifficultDisplayStreak(streak: number | null | undefined): number {
  const n = streak ?? 0;
  return Math.max(0, Math.min(3, n));
}

export function formatDifficultProgressLabel(streak: number): string {
  return `${clampDifficultDisplayStreak(streak)}/3`;
}
