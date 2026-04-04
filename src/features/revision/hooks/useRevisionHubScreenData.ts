import { useMemo } from "react";

import { useRevisionHubSession } from "@/src/features/revision/useRevisionHubSession";

import {
  computeRevisionHubTabViewKind,
  type RevisionHubTabViewKind,
} from "./revisionHubTabViewModel";

/**
 * Revision Hub tab: profile gating, hub stats, and session state — plus a normalized `viewKind`
 * for rendering (single source of truth for branch order).
 */
export function useRevisionHubScreenData() {
  const revision = useRevisionHubSession();

  const viewKind: RevisionHubTabViewKind = useMemo(
    () =>
      computeRevisionHubTabViewKind({
        settingsResolved: revision.settingsResolved,
        settingsFetchError: revision.settingsFetchError,
        onboardingRequiredConfirmed: revision.onboardingRequiredConfirmed,
        sessionPhase: revision.sessionPhase,
        sessionConfig: revision.sessionConfig,
        knownWords: revision.knownWords,
        mode: revision.mode,
        sessionFetchPending: revision.sessionFetchPending,
      }),
    [
      revision.knownWords,
      revision.mode,
      revision.onboardingRequiredConfirmed,
      revision.sessionConfig,
      revision.sessionFetchPending,
      revision.sessionPhase,
      revision.settingsFetchError,
      revision.settingsResolved,
    ],
  );

  return { ...revision, viewKind };
}
