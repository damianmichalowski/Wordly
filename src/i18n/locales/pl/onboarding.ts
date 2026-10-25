export default {
  onboarding: {
    signInSubtitleSessionRenew:
      "Zaloguj się ponownie, aby wczytać słowa i postęp z konta (sesja wygasła lub wylogowano).",
    signInSubtitleFirst:
      "Zaloguj się, aby zapisywać postęp i profil w Supabase. Wybierz konto Google lub Apple (iOS).",
    continueGoogle: "Kontynuuj z Google",
    continueApple: "Kontynuuj z Apple",
    alerts: {
      noSessionTitle: "Brak sesji",
      noSessionBody:
        "Nie jesteś zalogowany. Wróć na początek onboardingu i zaloguj się przez Google lub Apple.",
      missingDataTitle: "Brak danych",
      missingDataBody: "Wybierz oba języki.",
      invalidSelectionTitle: "Nieprawidłowy wybór",
      invalidSelectionBody: "Język ojczysty i nauki muszą być różne.",
      missingLevelTitle: "Brak danych",
      missingLevelBody: "Wybierz poziom trudności.",
      missingCategoryTitle: "Brak danych",
      missingCategoryBody: "Wybierz kategorię.",
    },
  },
} as const;
