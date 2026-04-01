import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import { PROFILE_SETTINGS_SAVED } from "@/src/events/profileSettingsEvents";
import { syncWidgetSnapshotFromApp } from "@/src/services/widgets/syncWidgetSnapshot";
import {
    getDailyWordWithDetails,
    markDailyWordAsKnown,
} from "../services/dailyWord.service";
import type { DailyWordResult } from "../types/dailyWord.types";

type DailyWordState = {
  isLoading: boolean;
  isSaving: boolean;
  /** Błąd pobrania, tylko flaga do UI; szczegóły wyłącznie w konsoli (__DEV__). */
  loadFailed: boolean;
  data: DailyWordResult | null;
};

const initialState: DailyWordState = {
  isLoading: true,
  isSaving: false,
  loadFailed: false,
  data: null,
};

export type UseDailyWordOptions = {
  /**
   * Wywoływane po RPC, zanim ustawimy `data: null` przy wyczerpanym torze.
   * Dzięki temu UI toru (np. `isTrackCompleted`) jest zsynchronizowane i nie miga „Brak słowa”.
   */
  onTrackExhausted?: () => Promise<void>;
};

export function useDailyWord(options?: UseDailyWordOptions) {
  const [state, setState] = useState<DailyWordState>(initialState);
  /** Anuluje zakończone `refresh()` po `markKnown`, żeby nie nadpisywały stanu `loadFailed` przy wyczerpanym torze. */
  const refreshAbortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    setState((prev) => ({ ...prev, isLoading: true, loadFailed: false }));
    try {
      const data = await getDailyWordWithDetails();
      if (controller.signal.aborted) {
        return;
      }
      setState({ isLoading: false, isSaving: false, loadFailed: false, data });
      void syncWidgetSnapshotFromApp();
    } catch (e) {
      if (controller.signal.aborted) {
        return;
      }
      if (__DEV__) {
        console.warn("[wordly] useDailyWord refresh failed", e);
      }
      setState({
        isLoading: false,
        isSaving: false,
        loadFailed: true,
        data: null,
      });
      void syncWidgetSnapshotFromApp();
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PROFILE_SETTINGS_SAVED, () => {
      void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const wordId = state.data?.details.word_id ?? null;

  const markKnown = useCallback(async (): Promise<
    "exhausted" | "next" | "skipped"
  > => {
    if (!wordId) {
      return "skipped";
    }
    refreshAbortRef.current?.abort();
    setState((prev) => ({ ...prev, isSaving: true, loadFailed: false }));
    try {
      const nextAssignment = await markDailyWordAsKnown(wordId);

      // The RPC already advanced the daily word for today.
      // If nothing is returned, it means no candidate words left.
      if (!nextAssignment) {
        refreshAbortRef.current?.abort();
        try {
          await options?.onTrackExhausted?.();
        } catch {
          // Postęp toru jest best-effort; i tak czyścimy dzienne słowo.
        }
        setState({
          isLoading: false,
          isSaving: false,
          loadFailed: false,
          data: null,
        });
        void syncWidgetSnapshotFromApp();
        return "exhausted";
      }

      // Fetch the current daily word after advancing.
      const data = await getDailyWordWithDetails();
      refreshAbortRef.current?.abort();
      setState({ isLoading: false, isSaving: false, loadFailed: false, data });
      void syncWidgetSnapshotFromApp();
      return "next";
    } catch (e) {
      if (__DEV__) {
        console.warn("[wordly] useDailyWord markKnown failed", e);
      }
      setState((prev) => ({
        ...prev,
        isSaving: false,
      }));
      return "skipped";
    }
  }, [options?.onTrackExhausted, wordId]);

  const canAct = useMemo(
    () => Boolean(state.data?.details?.word_id) && !state.isSaving,
    [state.data?.details?.word_id, state.isSaving],
  );

  return {
    isLoading: state.isLoading,
    isSaving: state.isSaving,
    loadFailed: state.loadFailed,
    data: state.data,
    canAct,
    refresh,
    markKnown,
  };
}
