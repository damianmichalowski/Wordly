/**
 * Authenticated app-entry achievements pipeline (not tied to Settings or a trophies screen).
 *
 * Mounted in `app/_layout.tsx` immediately under `AppBootstrapProvider`, so it runs as soon as
 * `AppBootstrapProvider` finishes its initial `getSession()` / `isReady` and the user has a
 * Supabase session (`isAuthenticated`). That is the first reliable moment to call
 * `process_app_entry_achievement_events()` so `achievement_entry_calendar_date` / midnight
 * known-word sync runs once per calendar day before the main tabs flow.
 *
 * Flow: session ready → RPC → expose `entryPendingEvents` → (later) reward UI → `consume_achievement_events`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { useAppBootstrap } from "@/src/hooks/useAppBootstrap";
import { hasSupabaseEnv } from "@/src/lib/supabase/client";

import {
  consumeAchievementEvents as consumeAchievementEventsRpc,
  processAppEntryAchievementEvents,
} from "./services/achievements.service";
import type { AchievementEventPayload } from "./types/achievementEvents.types";

type AchievementEventsContextValue = {
  /** True after the first successful app-entry sync attempt while authenticated. */
  entrySyncAttempted: boolean;
  /** Pending events from the latest `process_app_entry_achievement_events` (e.g. midnight known-word). */
  entryPendingEvents: AchievementEventPayload[];
  /** Re-run entry pipeline (e.g. after login retry). */
  runAppEntryAchievementSync: () => Promise<void>;
  /** Marks events consumed server-side and removes them from `entryPendingEvents`. */
  consumeAchievementEvents: (eventIds: string[]) => Promise<number>;
};

const AchievementEventsContext =
  createContext<AchievementEventsContextValue | null>(null);

export function AchievementEventsProvider({ children }: PropsWithChildren) {
  const { isReady, isAuthenticated } = useAppBootstrap();
  const [entrySyncAttempted, setEntrySyncAttempted] = useState(false);
  const [entryPendingEvents, setEntryPendingEvents] = useState<
    AchievementEventPayload[]
  >([]);

  const runAppEntryAchievementSync = useCallback(async () => {
    if (!hasSupabaseEnv() || !isAuthenticated) {
      return;
    }
    try {
      const result = await processAppEntryAchievementEvents();
      setEntryPendingEvents(result.pendingEvents);
    } catch (e) {
      if (__DEV__) {
        console.warn("[wordly] processAppEntryAchievementEvents failed", e);
      }
    } finally {
      setEntrySyncAttempted(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setEntryPendingEvents([]);
      setEntrySyncAttempted(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isReady || !isAuthenticated || !hasSupabaseEnv()) {
      return;
    }
    void runAppEntryAchievementSync();
  }, [isReady, isAuthenticated, runAppEntryAchievementSync]);

  const consumeAchievementEvents = useCallback(
    async (eventIds: string[]) => {
      if (eventIds.length === 0) {
        return 0;
      }
      const n = await consumeAchievementEventsRpc(eventIds);
      const idSet = new Set(eventIds);
      setEntryPendingEvents((prev) => prev.filter((e) => !idSet.has(e.eventId)));
      return n;
    },
    [],
  );

  const value = useMemo(
    () => ({
      entrySyncAttempted,
      entryPendingEvents,
      runAppEntryAchievementSync,
      consumeAchievementEvents,
    }),
    [
      consumeAchievementEvents,
      entryPendingEvents,
      entrySyncAttempted,
      runAppEntryAchievementSync,
    ],
  );

  return (
    <AchievementEventsContext.Provider value={value}>
      {children}
    </AchievementEventsContext.Provider>
  );
}

export function useAchievementEvents() {
  const ctx = useContext(AchievementEventsContext);
  if (!ctx) {
    throw new Error(
      "useAchievementEvents must be used within AchievementEventsProvider.",
    );
  }
  return ctx;
}
