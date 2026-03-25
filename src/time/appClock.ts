/**
 * Single place for "current time" in daily-word and calendar logic.
 * Override in tests via `setAppClockOverrideForTests` to simulate midnight rollover.
 */
let effectiveNowOverride: (() => Date) | null = null;

/** @internal test hook */
export function setAppClockOverrideForTests(fn: (() => Date) | null): void {
  effectiveNowOverride = fn;
}

export function getEffectiveNow(): Date {
  return effectiveNowOverride ? effectiveNowOverride() : new Date();
}

/** Local calendar key YYYY-MM-DD from {@link getEffectiveNow} (device timezone). */
export function getEffectiveCalendarDateKey(): string {
  const d = getEffectiveNow();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Milliseconds from `from` until the next local midnight (exclusive upper bound). */
export function msUntilNextLocalMidnight(from: Date = getEffectiveNow()): number {
  const next = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(1, next.getTime() - from.getTime());
}
