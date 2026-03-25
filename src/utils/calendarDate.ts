import { getEffectiveCalendarDateKey } from "@/src/time/appClock";

/**
 * Local calendar day key (YYYY-MM-DD) in the device timezone.
 * Delegates to {@link getEffectiveCalendarDateKey} so tests can override time.
 */
export function getLocalCalendarDateKey(): string {
  return getEffectiveCalendarDateKey();
}

export { getEffectiveNow } from "@/src/time/appClock";
