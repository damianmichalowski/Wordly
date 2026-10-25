import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import type { RevisionDashboardStats } from "@/src/types/revisionTracking";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import { dashboardStyles as s } from "./dashboardStyles";
import { DashboardHeroCard } from "./DashboardHeroCard";
import { DashboardStatGrid } from "./DashboardStatGrid";
import { DashboardMemoryCard } from "./DashboardMemoryCard";
import { DashboardBestSession } from "./DashboardBestSession";

type Props = {
  data: RevisionDashboardStats | undefined;
  isLoading: boolean;
  isError: boolean;
};

function DashboardSkeleton() {
  return (
    <>
      <View style={s.skeletonCard}>
        <View style={[s.skeletonLine, s.skeletonLineShort]} />
        <View style={[s.skeletonLine, s.skeletonLineWide]} />
        <View style={[s.skeletonLine, s.skeletonLineNarrow]} />
      </View>
      <View style={s.statGrid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={s.statCell}>
            <View style={[s.skeletonLine, s.skeletonLineShort]} />
            <View style={[s.skeletonLine, s.skeletonLineNarrow]} />
          </View>
        ))}
      </View>
    </>
  );
}

function DashboardEmpty() {
  return (
    <View style={s.emptyCard}>
      <Ionicons
        name="bar-chart-outline"
        size={28}
        color={StitchColors.onSurfaceVariant}
      />
      <Text style={s.emptyText}>
        Complete your first review to unlock progress stats.
      </Text>
    </View>
  );
}

function DashboardError() {
  return (
    <View style={s.emptyCard}>
      <Text style={s.errorText}>
        Progress stats are temporarily unavailable.
      </Text>
    </View>
  );
}

export function RevisionProgressDashboard({ data, isLoading, isError }: Props) {
  const isEmpty =
    !isLoading && !isError && data && data.allTime.reviewedWords === 0;

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Your progress</Text>

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError ? (
        <DashboardError />
      ) : isEmpty || !data ? (
        <DashboardEmpty />
      ) : (
        <>
          <DashboardHeroCard week={data.week} />
          <DashboardStatGrid stats={data} />
          <DashboardMemoryCard memory={data.memory} />
          <DashboardBestSession allTime={data.allTime} />
        </>
      )}
    </View>
  );
}
