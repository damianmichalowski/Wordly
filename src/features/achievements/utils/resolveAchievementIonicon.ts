import { Ionicons } from "@expo/vector-icons";

import type { UserAchievementRow } from "@/src/features/achievements/services/achievements.service";

/**
 * Ikona z `achievement_definition.icon` (Ionicons), jeśli jest i jest znana.
 * Fallback jak dawniej na kartach: odblokowane → `trophy`, zablokowane → `lock-closed`.
 */
export function resolveAchievementIonicon(
  row: UserAchievementRow,
): keyof typeof Ionicons.glyphMap {
  const candidate = row.definition.icon?.trim();
  if (candidate && candidate in Ionicons.glyphMap) {
    return candidate as keyof typeof Ionicons.glyphMap;
  }
  return row.unlocked ? "trophy" : "lock-closed";
}
