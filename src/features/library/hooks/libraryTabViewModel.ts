/**
 * Library tab: onboarding gate; transport/settings resolution is handled via list hydrating props.
 */
export type LibraryTabViewKind = "onboarding_required" | "library_content";

export function computeLibraryTabViewKind(input: {
  onboardingRequiredConfirmed: boolean;
}): LibraryTabViewKind {
  if (input.onboardingRequiredConfirmed) {
    return "onboarding_required";
  }
  return "library_content";
}
