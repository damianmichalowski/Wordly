export default {
  wordDetails: {
    headerFallbackTitle: "Word",
    a11yPronounce: "Pronounce",
    reportCta: "Report an issue",
    report: {
      sheetTitle: "Report an issue",
      issueSection: "What is wrong?",
      commentSection: "Comment (optional)",
      commentPlaceholder: "Add details that might help us fix it…",
      commentCounter: "{{count}} / {{max}}",
      commentTooLong: "Comment is too long (max {{max}} characters).",
      submit: "Send report",
      close: "Close",
      submitError: "Could not send report. Try again.",
      successTitle: "Thank you",
      successBody:
        "Your report was sent. We use these to improve Wordly's vocabulary.",
      issueTypes: {
        wrong_translation: "Wrong translation",
        missing_sense: "Missing translation",
        wrong_example: "Wrong example",
        wrong_pronunciation: "Wrong pronunciation / IPA",
        wrong_cefr: "Wrong CEFR level",
        wrong_category: "Wrong category",
        typo: "Typo",
        duplicate: "Duplicate word",
        other: "Other",
      },
    },
  },
} as const;
