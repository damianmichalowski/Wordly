import type { UserWordProgress } from "@/src/types/progress";

/** Klucz kalendarzowy w strefie lokalnej (YYYY-MM-DD). */
export function getTodayLocalDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoToLocalDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysIso(fromIso: string, days: number): string {
  const d = new Date(fromIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Pierwsza zaplanowana powtórka po oznaczeniu słowa jako „known” (bez wcześniejszego harmonogramu).
 */
export function initialNextReviewAfterMarkedKnown(markedAtIso: string): string {
  return addDaysIso(markedAtIso, 1);
}

const INTERVAL_DAYS_AFTER_REVIEW = [1, 3, 7, 14, 30, 60];

/**
 * `newReviewCount`: wartość `review_count` po udanej powtórce (po inkrementacji).
 */
export function computeNextReviewAfterReview(
  newReviewCount: number,
  now: Date,
): string {
  const idx = Math.min(
    Math.max(newReviewCount - 1, 0),
    INTERVAL_DAYS_AFTER_REVIEW.length - 1,
  );
  const days = INTERVAL_DAYS_AFTER_REVIEW[idx];
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Słowo jest „na dziś”, gdy brak harmonogramu (stare wpisy) albo termin minął (wg daty lokalnej).
 */
export function isDueForReview(
  p: UserWordProgress | undefined,
  now: Date = new Date(),
): boolean {
  if (!p || p.status !== "known") {
    return false;
  }
  if (!p.nextReviewAt?.trim()) {
    return true;
  }
  const today = getTodayLocalDateKey();
  return isoToLocalDateKey(p.nextReviewAt) <= today;
}
