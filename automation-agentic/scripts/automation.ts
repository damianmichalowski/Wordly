#!/usr/bin/env tsx
import { loadDotenv } from "../src/io/env";
import { ensureDirs } from "../src/io/paths";
import { helpText, parseCli } from "../src/pipeline/cli";
import { loadConfig } from "../src/pipeline/config";
import { runPipeline } from "../src/pipeline/runner";

async function main() {
  loadDotenv();
  ensureDirs();

  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0 || rawArgs.includes("--help") || rawArgs.includes("-h")) {
    console.log(helpText());
    return;
  }

  const cli = parseCli(rawArgs);
  const config = loadConfig(cli.mode as any);
  await runPipeline(config as any, cli);
}

main().catch((error) => {
  console.error("\n❌ Automation stopped");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
