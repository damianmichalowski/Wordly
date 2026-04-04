import { invalidateAfterProfileOrSettingsChange } from "@/src/lib/query/invalidateAfterMutations";
import { queryClient } from "@/src/lib/query/queryClient";

/** @deprecated Prefer calling `invalidateAfterProfileOrSettingsChange` where you have a `QueryClient`. */
export function emitProfileSettingsSaved(): void {
  invalidateAfterProfileOrSettingsChange(queryClient);
}
