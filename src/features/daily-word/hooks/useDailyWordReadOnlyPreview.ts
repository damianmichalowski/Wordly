import { useQuery } from "@tanstack/react-query";

import { getDailyWordDetailsReadOnly } from "@/src/features/daily-word/services/dailyWord.service";
import { hasSupabaseEnv } from "@/src/lib/supabase/client";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { staleTimes } from "@/src/lib/query/staleTimes";

/**
 * Read-only snapshot for Settings widget preview — does not call `get_or_create_daily_word`.
 * Pass `screenActive` (e.g. `useIsFocused()`) to avoid RPC when the Settings tab is not visible.
 */
export function useDailyWordReadOnlyPreview(screenActive = true) {
  return useQuery({
    queryKey: queryKeys.dailyWord.readOnlyDetails,
    queryFn: getDailyWordDetailsReadOnly,
    staleTime: staleTimes.dailyWordReadOnlyDetails,
    enabled: hasSupabaseEnv() && screenActive,
  });
}
