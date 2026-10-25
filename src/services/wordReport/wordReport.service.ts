import { rpc } from "@/src/lib/supabase/rpc";

import { prepareWordReportComment } from "./wordReportComment";
import {
  WORD_REPORT_ISSUE_TYPES,
  type WordReportIssueType,
} from "./wordReport.types";

export function isWordReportIssueType(value: string): value is WordReportIssueType {
  return (WORD_REPORT_ISSUE_TYPES as readonly string[]).includes(value);
}

export async function submitWordReport(args: {
  wordId: string;
  issueType: WordReportIssueType;
  comment?: string | null;
}): Promise<void> {
  const prepared = prepareWordReportComment(args.comment);
  if (!prepared.ok) {
    throw new Error("WORD_REPORT_COMMENT_TOO_LONG");
  }

  const { error } = await rpc("submit_word_report", {
    p_word_id: args.wordId,
    p_issue_type: args.issueType,
    p_comment: prepared.comment,
  });

  if (error) {
    throw new Error(`Failed to submit word report: ${error.message}`);
  }
}
