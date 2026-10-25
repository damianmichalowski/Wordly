import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import type { RevisionDashboardAllTime } from "@/src/types/revisionTracking";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import { dashboardStyles as s } from "./dashboardStyles";

type Props = {
  allTime: RevisionDashboardAllTime;
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
}

export function DashboardBestSession({ allTime }: Props) {
  const hasBest =
    allTime.bestAccuracy != null ||
    allTime.bestSessionWords != null ||
    allTime.bestTimeSeconds != null;

  if (!hasBest) {
    return null;
  }

  const parts: string[] = [];
  if (allTime.bestAccuracy != null) {
    parts.push(`${allTime.bestAccuracy}% accuracy`);
  }
  if (allTime.bestSessionWords != null) {
    parts.push(`${allTime.bestSessionWords} words`);
  }
  if (allTime.bestTimeSeconds != null && allTime.bestTimeSeconds > 0) {
    parts.push(formatDuration(allTime.bestTimeSeconds));
  }

  if (parts.length === 0) {
    return null;
  }

  return (
    <View style={s.bestCard}>
      <View style={s.bestIconCircle}>
        <Ionicons name="trophy-outline" size={20} color={StitchColors.primary} />
      </View>
      <View style={s.bestContent}>
        <Text style={s.bestLabel}>Best session</Text>
        <Text style={s.bestValue} numberOfLines={1}>
          {parts.join(" · ")}
        </Text>
      </View>
    </View>
  );
}
