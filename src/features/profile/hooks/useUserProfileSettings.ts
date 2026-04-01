import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import { PROFILE_SETTINGS_SAVED } from "@/src/events/profileSettingsEvents";
import { getUserProfileSettings } from "@/src/features/profile/services/profile.service";
import type { UserProfileSettings } from "@/src/features/profile/types/profile.types";

type UserProfileSettingsState = {
  isLoading: boolean;
  error: string | null;
  data: UserProfileSettings | null;
};

const initialState: UserProfileSettingsState = {
  isLoading: true,
  error: null,
  data: null,
};

export function useUserProfileSettings() {
  const [state, setState] = useState<UserProfileSettingsState>(initialState);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await getUserProfileSettings();
      setState({ isLoading: false, error: null, data });
    } catch (e) {
      setState({
        isLoading: false,
        error:
          e instanceof Error
            ? e.message
            : "Failed to load profile settings.",
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

