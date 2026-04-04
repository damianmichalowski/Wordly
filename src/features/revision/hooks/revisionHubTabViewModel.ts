import type { RevisionMode } from "@/src/types/revisionSession";
import type { RevisionSessionConfig, RevisionSessionPhase } from "@/src/types/revisionSession";
import type { VocabularyWord } from "@/src/types/words";

/**
 * Normalized top-level render branch for the Revision Hub tab.
 * Order matches `RevisionHubTabScreen`: data-source / gate states before session UI.
 */
export type RevisionHubTabViewKind =
  | "settings_transport_error"
  | "settings_pending_shell"
  | "onboarding_required"
  | "revision_hub_surface"
  | "empty_session_list"
  | "flashcard_session";

export type RevisionHubTabViewInput = {
  settingsResolved: boolean;
  settingsFetchError: boolean;
  onboardingRequiredConfirmed: boolean;
  sessionPhase: RevisionSessionPhase;
  sessionConfig: RevisionSessionConfig | null;
  knownWords: VocabularyWord[];
  mode: RevisionMode;
  sessionFetchPending: boolean;
};

export function computeRevisionHubTabViewKind(
  input: RevisionHubTabViewInput,
): RevisionHubTabViewKind {
  if (input.settingsFetchError) {
    return "settings_transport_error";
  }
  if (!input.settingsResolved) {
    return "settings_pending_shell";
  }
  if (input.onboardingRequiredConfirmed) {
    return "onboarding_required";
  }
  if (input.sessionPhase === "hub") {
    return "revision_hub_surface";
  }
  if (
    input.sessionConfig &&
    input.knownWords.length === 0 &&
    input.mode === "list" &&
    !input.sessionFetchPending
  ) {
    return "empty_session_list";
  }
  if (input.sessionPhase === "session" && input.mode === "flashcards") {
    return "flashcard_session";
  }
  return "revision_hub_surface";
}
