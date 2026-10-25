export default {
  wordDetails: {
    headerFallbackTitle: "Słowo",
    a11yPronounce: "Wymowa",
    reportCta: "Zgłoś błąd",
    report: {
      sheetTitle: "Zgłoś błąd",
      issueSection: "Co jest nie tak?",
      commentSection: "Komentarz (opcjonalnie)",
      commentPlaceholder: "Dodaj szczegóły, które pomogą nam to poprawić…",
      commentCounter: "{{count}} / {{max}}",
      commentTooLong: "Komentarz jest za długi (maks. {{max}} znaków).",
      submit: "Wyślij zgłoszenie",
      close: "Zamknij",
      submitError: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie.",
      successTitle: "Dziękujemy",
      successBody:
        "Zgłoszenie zostało wysłane. Wykorzystujemy je do poprawy słownictwa w Wordly.",
      issueTypes: {
        wrong_translation: "Błędne tłumaczenie",
        missing_sense: "Brakujące tłumaczenie",
        wrong_example: "Błędny przykład",
        wrong_pronunciation: "Błędna wymowa / IPA",
        wrong_cefr: "Zły poziom CEFR",
        wrong_category: "Zła kategoria",
        typo: "Literówka",
        duplicate: "Duplikat słówka",
        other: "Inne",
      },
    },
  },
} as const;
