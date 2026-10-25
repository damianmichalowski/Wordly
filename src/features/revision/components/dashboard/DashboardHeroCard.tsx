import { Text, View } from "react-native";

import type { RevisionDashboardWeek } from "@/src/types/revisionTracking";
import { dashboardStyles as s } from "./dashboardStyles";

type Props = {
  week: RevisionDashboardWeek;
};

export function DashboardHeroCard({ week }: Props) {
  const hasActivity = week.reviewedWords > 0;

  const improvementLine = (() => {
    if (week.improvementPercent == null || !hasActivity) {
      return { text: "Keep going — your memory is growing", positive: false };
    }
    if (week.improvementPercent > 0) {
      return {
        text: `+${week.improvementPercent}% better than last week`,
        positive: true,
      };
    }
    if (week.improvementPercent < 0) {
      return {
        text: "Good practice — these words will come back soon",
        positive: false,
      };
    }
    return { text: "Keep going — your memory is growing", positive: false };
  })();

  return (
    <View style={s.heroCard}>
      <Text style={s.heroValue}>
        {hasActivity ? week.reviewedWords : 0}
      </Text>
      <Text style={s.heroLabel}>words reviewed this week</Text>
      {hasActivity ? (
        <View style={s.heroAccuracyRow}>
          <Text style={s.heroAccuracyValue}>{week.accuracy}% accuracy</Text>
        </View>
      ) : null}
      <Text
        style={
          improvementLine.positive
            ? s.heroImprovementPositive
            : s.heroImprovementNeutral
        }
      >
        {improvementLine.text}
      </Text>
    </View>
  );
}
