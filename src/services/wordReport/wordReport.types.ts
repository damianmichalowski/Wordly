export const WORD_REPORT_ISSUE_TYPES = [
  "wrong_translation",
  "missing_sense",
  "wrong_example",
  "wrong_pronunciation",
  "wrong_cefr",
  "wrong_category",
  "typo",
  "duplicate",
  "other",
] as const;

export type WordReportIssueType = (typeof WORD_REPORT_ISSUE_TYPES)[number];

/** Matches `word_report_comment_length_check` and `submit_word_report` in Postgres. */
export const WORD_REPORT_COMMENT_MAX_LENGTH = 500;
