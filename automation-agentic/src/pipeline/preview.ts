import { FinalBatch, PipelineReport } from "../types";

export function buildPreviewMarkdown(batch: FinalBatch, reportDraft: Pick<PipelineReport, "run_id" | "mode" | "requested_size" | "usage" | "usage_totals" | "validation">) {
  const senseCount = batch.entries.reduce((sum, entry) => sum + entry.senses.length, 0);
  const lines: string[] = [];

  lines.push(`# Wordly Agentic Preview`);
  lines.push("");
  lines.push(`Run: \`${reportDraft.run_id}\``);
  lines.push(`Mode: **${reportDraft.mode}**`);
  if (batch.level) lines.push(`Level: **${batch.level}**`);
  if (batch.category) lines.push(`Category: **${batch.category}**`);
  lines.push(`Languages: **${batch.target_language} → ${batch.source_language}**`);
  lines.push(`Batch: **${batch.batch}**`);
  lines.push(`Entries: **${batch.entries.length}/${reportDraft.requested_size}**`);
  lines.push(`Senses: **${senseCount}**`);
  lines.push("");

  lines.push(`## Usage & time`);
  lines.push("");
  lines.push(`Total tokens: **${reportDraft.usage_totals.total_tokens}**`);
  lines.push(`Input/output: **${reportDraft.usage_totals.input_tokens}/${reportDraft.usage_totals.output_tokens}**`);
  if (reportDraft.usage_totals.estimated_cost_usd !== undefined) {
    lines.push(`Estimated cost: **$${reportDraft.usage_totals.estimated_cost_usd.toFixed(5)}**`);
  }
  lines.push("");
  lines.push(`| Step | Model | Time | Input | Output | Total | Cost |`);
  lines.push(`|---|---:|---:|---:|---:|---:|---:|`);
  for (const item of reportDraft.usage) {
    lines.push(`| ${item.step} | ${item.model} | ${(item.duration_ms / 1000).toFixed(1)}s | ${item.input_tokens} | ${item.output_tokens} | ${item.total_tokens} | ${item.estimated_cost_usd === undefined ? "" : `$${item.estimated_cost_usd.toFixed(5)}`} |`);
  }
  lines.push("");

  lines.push(`## Validation`);
  lines.push("");
  lines.push(reportDraft.validation.passed ? `✅ Passed` : `❌ Failed`);
  if (reportDraft.validation.errors.length) {
    lines.push("");
    lines.push(`Errors:`);
    for (const err of reportDraft.validation.errors) lines.push(`- ${err}`);
  }
  if (reportDraft.validation.warnings.length) {
    lines.push("");
    lines.push(`Warnings:`);
    for (const warn of reportDraft.validation.warnings) lines.push(`- ${warn}`);
  }
  lines.push("");

  lines.push(`## Final entries`);
  lines.push("");
  for (const entry of batch.entries) {
    lines.push(`### ${entry.lemma} ${entry.ipa} — ${entry.level}`);
    lines.push("");
    lines.push(`| # | POS | Translation | Example 1 | Example 2 |`);
    lines.push(`|---:|---|---|---|---|`);
    for (const sense of entry.senses) {
      const ex1 = sense.translation.examples.find((ex) => ex.example_order === 1)?.text ?? "";
      const ex2 = sense.translation.examples.find((ex) => ex.example_order === 2)?.text ?? "";
      lines.push(`| ${sense.sense_order} | ${sense.part_of_speech} | ${sense.translation.text} | ${ex1} | ${ex2} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
