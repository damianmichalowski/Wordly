import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { LearningOptionsProgress } from "@/src/features/profile/services/learningProgress.service";
import { getLearningOptionsProgress } from "@/src/features/profile/services/learningProgress.service";
import {
    getOnboardingOptions,
    getUserProfileSettings,
    invalidateTodayDailyWord,
    upsertUserProfileSettings,
} from "@/src/features/profile/services/profile.service";
import type {
    LearningLevel,
    LearningModeType,
    OnboardingCategory,
    OnboardingLanguage,
    OnboardingOptions,
    UpsertUserProfileSettingsInput,
    UserProfileSettings,
} from "@/src/features/profile/types/profile.types";
import { USER_FACING_SETTINGS_SAVE_FAILED } from "@/src/components/ui/transportRetry.constants";
import { invalidateAfterProfileOrSettingsChange } from "@/src/lib/query/invalidateAfterMutations";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { staleTimes } from "@/src/lib/query/staleTimes";

type SettingsFormState = {
  options: OnboardingOptions | null;
  optionsProgress: LearningOptionsProgress | null;
  settings: UserProfileSettings | null;
  nativeLanguageId: string | null;
  learningLanguageId: string | null;
  learningModeType: LearningModeType;
  learningLevel: LearningLevel | null;
  selectedCategoryId: string | null;
  error?: string;
};

const defaultFormState: SettingsFormState = {
  options: null,
  optionsProgress: null,
  settings: null,
  nativeLanguageId: null,
  learningLanguageId: null,
  learningModeType: "difficulty",
  learningLevel: null,
  selectedCategoryId: null,
};

export function useSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsFormState>(defaultFormState);

  const optionsQuery = useQuery({
    queryKey: queryKeys.onboarding.options,
    queryFn: getOnboardingOptions,
    staleTime: staleTimes.onboardingOptions,
    placeholderData: keepPreviousData,
  });

  const settingsQuery = useQuery({
    queryKey: queryKeys.profile.settings,
    queryFn: getUserProfileSettings,
    staleTime: staleTimes.profileSettings,
    placeholderData: keepPreviousData,
  });

  const optionsProgressQuery = useQuery({
    queryKey: queryKeys.learning.optionsProgress,
    queryFn: () => getLearningOptionsProgress().catch(() => null),
    staleTime: staleTimes.learningOptionsProgress,
  });

  /** Blokuj UI tylko na onboarding + settings; postęp opcji może dograć się w tle (bez migania). */
  const isLoading =
    !optionsQuery.isFetched || !settingsQuery.isFetched;

  /** Brak cache + błąd — nie da się zbudować formularza; nie mylić z „brak profilu” po sukcesie RPC. */
  const blockingLoadError =
    (optionsQuery.isFetched &&
      optionsQuery.isError &&
      optionsQuery.data === undefined) ||
    (settingsQuery.isFetched &&
      settingsQuery.isError &&
      settingsQuery.data === undefined);

  /** Wyłącznie po udanym `get_user_profile_settings` zwracającym `null`. */
  const onboardingRequiredConfirmed =
    settingsQuery.isSuccess && settingsQuery.data === null;

  const blockingRetryBusy =
    blockingLoadError &&
    (optionsQuery.isFetching || settingsQuery.isFetching);

  /** Spinner na „Spróbuj ponownie” przy pierwszym ładowaniu / po „stuck” timeout. */
  const settingsInitialFetchBusy =
    !blockingLoadError &&
    isLoading &&
    (optionsQuery.isFetching || settingsQuery.isFetching);

  useEffect(() => {
    const options = optionsQuery.data;
    const optionsProgress = optionsProgressQuery.data ?? null;
    if (!options) {
      return;
    }
    if (!settingsQuery.isFetched) {
      return;
    }
    if (settingsQuery.isError) {
      setForm((prev) => ({
        ...prev,
        options,
        optionsProgress,
        error: undefined,
      }));
      return;
    }
    const settings = settingsQuery.data;
    setForm((prev) => ({
      ...prev,
      options,
      optionsProgress,
      settings: settings ?? null,
      nativeLanguageId:
        settings?.native_language?.id ?? options.languages[0]?.id ?? null,
      learningLanguageId:
        settings?.learning_language?.id ?? options.languages[0]?.id ?? null,
      learningModeType: settings?.learning_mode_type ?? "difficulty",
      learningLevel: (settings?.learning_level ?? null) as LearningLevel | null,
      selectedCategoryId: settings?.selected_category?.id ?? null,
      error: undefined,
    }));
  }, [
    optionsQuery.data,
    settingsQuery.isFetched,
    settingsQuery.isError,
    settingsQuery.data,
    optionsProgressQuery.data,
  ]);

  const saveMutation = useMutation({
    networkMode: "always",
    mutationFn: async (input: UpsertUserProfileSettingsInput) => {
      const saved = await upsertUserProfileSettings(input);
      await invalidateTodayDailyWord();
      return saved;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.profile.settings, saved);
      invalidateAfterProfileOrSettingsChange(queryClient, {
        skipSettingsQuery: true,
      });
      setForm((prev) => ({
        ...prev,
        settings: saved,
        nativeLanguageId: saved.native_language.id,
        learningLanguageId: saved.learning_language.id,
        learningModeType: saved.learning_mode_type,
        learningLevel: (saved.learning_level ?? null) as LearningLevel | null,
        selectedCategoryId: saved.selected_category?.id ?? null,
      }));
    },
    onError: (e) => {
      if (__DEV__) {
        console.warn("[wordly] useSettings save failed", e);
      }
      setForm((prev) => ({
        ...prev,
        error: USER_FACING_SETTINGS_SAVE_FAILED,
      }));
    },
  });

  const save = useCallback(async () => {
    if (!form.options) {
      return;
    }
    if (!form.nativeLanguageId || !form.learningLanguageId) {
      setForm((prev) => ({ ...prev, error: "Please select both languages." }));
      return;
    }
    if (form.nativeLanguageId === form.learningLanguageId) {
      setForm((prev) => ({
        ...prev,
        error: "Native and learning language must be different.",
      }));
      return;
    }
    if (form.learningModeType === "difficulty" && !form.learningLevel) {
      setForm((prev) => ({
        ...prev,
        error: "Please select a difficulty level.",
      }));
      return;
    }
    if (form.learningModeType === "category" && !form.selectedCategoryId) {
      setForm((prev) => ({ ...prev, error: "Please select a category." }));
      return;
    }

    setForm((prev) => ({ ...prev, error: undefined }));
    saveMutation.mutate({
      p_native_language_id: form.nativeLanguageId,
      p_learning_language_id: form.learningLanguageId,
      p_learning_mode_type: form.learningModeType,
      p_learning_level:
        form.learningModeType === "difficulty"
          ? (form.learningLevel ?? undefined)
          : undefined,
      p_selected_category_id:
        form.learningModeType === "category"
          ? (form.selectedCategoryId ?? undefined)
          : undefined,
    });
  }, [form, saveMutation]);

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.options }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.settings }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.learning.optionsProgress,
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.summary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.achievements.list }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.dailyWord.readOnlyDetails,
      }),
    ]);
  }, [queryClient]);

  const canSave = useMemo(() => {
    if (saveMutation.isPending || isLoading) {
      return false;
    }
    if (!form.nativeLanguageId || !form.learningLanguageId) {
      return false;
    }
    if (form.nativeLanguageId === form.learningLanguageId) {
      return false;
    }
    if (form.learningModeType === "difficulty") {
      return form.learningLevel != null;
    }
    return form.selectedCategoryId != null;
  }, [
    saveMutation.isPending,
    form.learningLanguageId,
    form.learningLevel,
    form.learningModeType,
    form.nativeLanguageId,
    form.selectedCategoryId,
    isLoading,
  ]);

  const nativeLanguage = useMemo<OnboardingLanguage | null>(() => {
    if (!form.options || !form.nativeLanguageId) {
      return null;
    }
    return (
      form.options.languages.find((l) => l.id === form.nativeLanguageId) ?? null
    );
  }, [form.nativeLanguageId, form.options]);

  const learningLanguage = useMemo<OnboardingLanguage | null>(() => {
    if (!form.options || !form.learningLanguageId) {
      return null;
    }
    return (
      form.options.languages.find((l) => l.id === form.learningLanguageId) ??
      null
    );
  }, [form.learningLanguageId, form.options]);

  const selectedCategory = useMemo<OnboardingCategory | null>(() => {
    if (!form.options || !form.selectedCategoryId) {
      return null;
    }
    return (
      form.options.categories.find((c) => c.id === form.selectedCategoryId) ??
      null
    );
  }, [form.options, form.selectedCategoryId]);

  /** Top-level gates only; inner `isLoading` skeleton stays in the screen. */
  const viewKind = useMemo(():
    | "blocking_load_error"
    | "onboarding_required"
    | "main" => {
    if (blockingLoadError) {
      return "blocking_load_error";
    }
    if (!isLoading && onboardingRequiredConfirmed) {
      return "onboarding_required";
    }
    return "main";
  }, [blockingLoadError, isLoading, onboardingRequiredConfirmed]);

  return {
    viewKind,
    isLoading,
    blockingLoadError,
    blockingRetryBusy,
    settingsInitialFetchBusy,
    onboardingRequiredConfirmed,
    isSaving: saveMutation.isPending,
    options: form.options,
    optionsProgress: form.optionsProgress,
    settings: form.settings,
    nativeLanguageId: form.nativeLanguageId,
    learningLanguageId: form.learningLanguageId,
    learningModeType: form.learningModeType,
    learningLevel: form.learningLevel,
    selectedCategoryId: form.selectedCategoryId,
    error: form.error,
    canSave,
    nativeLanguage,
    learningLanguage,
    selectedCategory,
    setNativeLanguageId: (id: string) =>
      setForm((prev) => ({ ...prev, nativeLanguageId: id })),
    setLearningLanguageId: (id: string) =>
      setForm((prev) => ({ ...prev, learningLanguageId: id })),
    setLearningModeType: (value: LearningModeType) =>
      setForm((prev) => ({
        ...prev,
        learningModeType: value,
      })),
    setLearningLevel: (value: LearningLevel | null) =>
      setForm((prev) => ({
        ...prev,
        learningLevel: value,
        ...(value != null ? { selectedCategoryId: null } : {}),
      })),
    setSelectedCategoryId: (id: string | null) =>
      setForm((prev) => ({
        ...prev,
        selectedCategoryId: id,
        ...(id != null ? { learningLevel: null } : {}),
      })),
    save,
    refresh,
  };
}
