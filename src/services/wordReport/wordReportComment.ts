import { WORD_REPORT_COMMENT_MAX_LENGTH } from "@/src/services/wordReport/wordReport.types";

export type PrepareWordReportCommentResult =
  | { ok: true; comment: string | null }
  | { ok: false; reason: "too_long" };

/** Trims optional report details; empty/whitespace becomes null. */
export function prepareWordReportComment(
  raw: string | null | undefined,
): PrepareWordReportCommentResult {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) {
    return { ok: true, comment: null };
  }
  if (trimmed.length > WORD_REPORT_COMMENT_MAX_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, comment: trimmed };
}
