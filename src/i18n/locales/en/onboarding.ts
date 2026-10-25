export default {
  onboarding: {
    signInSubtitleSessionRenew:
      "Sign in again to load your words and progress from your account (session expired or signed out).",
    signInSubtitleFirst:
      "Sign in to save progress and your profile in Supabase. Choose Google or Apple (iOS).",
    continueGoogle: "Continue with Google",
    continueApple: "Continue with Apple",
    alerts: {
      noSessionTitle: "No session",
      noSessionBody:
        "You are not signed in. Go back to the start of onboarding and sign in with Google or Apple.",
      missingDataTitle: "Missing data",
      missingDataBody: "Please select both languages.",
      invalidSelectionTitle: "Invalid selection",
      invalidSelectionBody: "Native and learning language must be different.",
      missingLevelTitle: "Missing data",
      missingLevelBody: "Please select your difficulty level.",
      missingCategoryTitle: "Missing data",
      missingCategoryBody: "Please select a category.",
    },
  },
} as const;
