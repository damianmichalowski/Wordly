import { useEffect, useState } from "react";

/** Domyślny czas po którym uznajemy „zawieszone” ładowanie (offline / wolna sieć) zanim przyjdzie `isError` z React Query. */
export const STUCK_LOADING_MS = 14_000;

/** Ładowanie talii w sesji fiszek — szybszy komunikat transportu niż globalne 14 s (bez NetInfo). */
export const SESSION_FLASHCARD_STUCK_MS = 5_000;

/**
 * Zwraca `true` gdy `active` jest prawdą nieprzerwanie przez co najmniej `ms` ms.
 * Reset gdy `active` wróci do `false`.
 * `resetKey` — zmiana (np. kolejna próba „Spróbuj ponownie”) zeruje licznik i `stuck`.
 */
export function useStuckLoading(
  active: boolean,
  ms: number = STUCK_LOADING_MS,
  resetKey: number | string = 0,
): boolean {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    setStuck(false);
  }, [resetKey]);

  useEffect(() => {
    if (!active) {
      setStuck(false);
      return;
    }
    const id = setTimeout(() => setStuck(true), ms);
    return () => clearTimeout(id);
  }, [active, ms, resetKey]);

  return stuck;
}
