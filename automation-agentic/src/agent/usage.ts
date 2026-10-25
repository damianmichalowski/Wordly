import { PriceConfig, UsageRecord } from "../types";

export class UsageTracker {
  private records: UsageRecord[] = [];

  add(record: UsageRecord) {
    this.records.push(record);
  }

  all() {
    return [...this.records];
  }

  totals() {
    const input_tokens = this.records.reduce((sum, item) => sum + item.input_tokens, 0);
    const output_tokens = this.records.reduce((sum, item) => sum + item.output_tokens, 0);
    const total_tokens = this.records.reduce((sum, item) => sum + item.total_tokens, 0);
    const costRecords = this.records.filter((item) => item.estimated_cost_usd !== undefined);
    const estimated_cost_usd = costRecords.length
      ? costRecords.reduce((sum, item) => sum + (item.estimated_cost_usd ?? 0), 0)
      : undefined;
    return { input_tokens, output_tokens, total_tokens, estimated_cost_usd };
  }
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number, prices?: PriceConfig) {
  const price = prices?.[model];
  if (!price) return undefined;
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}
