import { Text, View } from "react-native";

import type { RevisionDashboardStats } from "@/src/types/revisionTracking";
import { dashboardStyles as s } from "./dashboardStyles";

type Props = {
  stats: RevisionDashboardStats;
};

function StatCell({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={s.statCell}>
      <Text style={s.statCellValue}>{value}</Text>
      <Text style={s.statCellLabel}>{label}</Text>
    </View>
  );
}

export function DashboardStatGrid({ stats }: Props) {
  return (
    <View style={s.statGrid}>
      <StatCell value={stats.allTime.knownWords} label="Known words" />
      <StatCell value={stats.memory.dueToday} label="Due today" />
      <StatCell
        value={stats.allTime.accuracy > 0 ? `${stats.allTime.accuracy}%` : "—"}
        label="Accuracy"
      />
      <StatCell value={stats.week.sessionsCount} label="Sessions this week" />
    </View>
  );
}
