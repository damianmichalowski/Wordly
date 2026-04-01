import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import { PROFILE_SETTINGS_SAVED } from "@/src/events/profileSettingsEvents";
import type { LearningTrackProgress } from "@/src/features/profile/services/learningProgress.service";
import { getLearningTrackProgress } from "@/src/features/profile/services/learningProgress.service";

type LearningTrackProgressState = {
  isLoading: boolean;
  error: string | null;
  data: LearningTrackProgress | null;
};

const initialState: LearningTrackProgressState = {
  isLoading: true,
  error: null,
  data: null,
};

export function useLearningTrackProgress() {
  const [state, setState] = useState<LearningTrackProgressState>(initialState);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await getLearningTrackProgress();
      setState({ isLoading: false, error: null, data });
    } catch (e) {
      setState({
        isLoading: false,
        error:
          e instanceof Error
            ? e.message
            : "Failed to load learning track progress.",
        data: null,
      });
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

  return {
    isLoading: state.isLoading,
    error: state.error,
    data: state.data,
    refresh,
  };
}

