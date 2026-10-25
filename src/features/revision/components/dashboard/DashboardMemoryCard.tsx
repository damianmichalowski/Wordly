import { Text, View } from "react-native";
import type { ViewStyle } from "react-native";

import type { RevisionDashboardMemory } from "@/src/types/revisionTracking";
import { dashboardStyles as s } from "./dashboardStyles";

type Props = {
  memory: RevisionDashboardMemory;
};

function MemoryRow({
  label,
  count,
  total,
  barStyle,
}: {
  label: string;
  count: number;
  total: number;
  barStyle: ViewStyle;
}) {
  const ratio = total > 0 ? Math.min(count / total, 1) : 0;
  return (
    <View style={s.memoryRow}>
      <View style={s.memoryRowHeader}>
        <Text style={s.memoryRowLabel}>{label}</Text>
        <Text style={s.memoryRowCount}>{count}</Text>
      </View>
      <View style={s.memoryBarTrack}>
        {count > 0 ? (
          <View
            style={[s.memoryBarFill, barStyle, { width: `${ratio * 100}%` }]}
          />
        ) : null}
      </View>
    </View>
  );
}

export function DashboardMemoryCard({ memory }: Props) {
  const total = memory.strongWords + memory.dueSoon + memory.needAttention;

  if (total === 0) {
    return null;
  }

  return (
    <View style={s.memoryCard}>
      <Text style={s.memoryTitle}>Memory status</Text>
      <MemoryRow
        label="Strong memory"
        count={memory.strongWords}
        total={total}
        barStyle={s.memoryBarStrong}
      />
      <MemoryRow
        label="Due soon"
        count={memory.dueSoon}
        total={total}
        barStyle={s.memoryBarDueSoon}
      />
      <MemoryRow
        label="Needs attention"
        count={memory.needAttention}
        total={total}
        barStyle={s.memoryBarAttention}
      />
    </View>
  );
}
