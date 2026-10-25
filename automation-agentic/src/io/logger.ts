import fs from "fs";
import path from "path";
import { UsageRecord } from "../types";

function sec(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

export class HumanLogger {
  private lines: string[] = [];

  constructor(
    private readonly logFile?: string,
    private readonly verbose = false
  ) {}

  private write(message: string, printToTerminal = true) {
    const line = message;
    this.lines.push(line);
    if (printToTerminal) console.log(line);
  }

  title(message: string) {
    this.write(`\n🚀 ${message}`);
  }

  info(message: string) {
    this.write(`ℹ️  ${message}`);
  }

  detail(message: string) {
    this.write(`   · ${message}`, this.verbose);
  }

  step(message: string) {
    this.write(`\n🧠 ${message}`);
  }

  success(message: string) {
    this.write(`✅ ${message}`);
  }

  warn(message: string) {
    this.write(`⚠️  ${message}`);
  }

  fail(message: string) {
    this.write(`❌ ${message}`);
  }

  usage(record: UsageRecord) {
    const cost = record.estimated_cost_usd === undefined ? "" : ` • ~$${record.estimated_cost_usd.toFixed(5)}`;
    this.detail(`${record.step} • ${sec(record.duration_ms)} • tokens in/out=${record.input_tokens}/${record.output_tokens}${cost}`);
  }

  save() {
    if (!this.logFile) return;
    fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
    fs.writeFileSync(this.logFile, `${this.lines.join("\n")}\n`, "utf-8");
  }
}
