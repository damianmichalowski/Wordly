/**
 * Library tab: settings error and onboarding gates are explicit; everything else is `library_content`
 * (list handles hydrating / empty / error via props — not duplicated here).
 */
export type LibraryTabViewKind =
  | "settings_transport_error"
  | "onboarding_required"
  | "library_content";

export function computeLibraryTabViewKind(input: {
  settingsFetchError: boolean;
  onboardingRequiredConfirmed: boolean;
}): LibraryTabViewKind {
  if (input.settingsFetchError) {
    return "settings_transport_error";
  }
  if (input.onboardingRequiredConfirmed) {
    return "onboarding_required";
  }
  return "library_content";
}
