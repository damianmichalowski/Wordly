#!/usr/bin/env tsx
import { getCategoryCoverage } from "../src/db/postgrest";
import { loadDotenv } from "../src/io/env";
import { ensureDirs } from "../src/io/paths";
import { loadConfig } from "../src/pipeline/config";
import { CategoryConfig } from "../src/types";
import { getCategoryCodes, getCategoryTargetWords } from "../src/pipeline/categorySettings";

function readValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

async function main() {
  loadDotenv();
  ensureDirs();

  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage:\n  npx tsx automation-agentic/scripts/category-coverage.ts\n  npx tsx automation-agentic/scripts/category-coverage.ts --category travel\n\nPrints current category coverage for target language using config/category.json.`);
    return;
  }

  const config = loadConfig("category") as CategoryConfig;
  const requested = readValue(args, "--category");
  const categories = requested ? [requested] : getCategoryCodes(config);
  const coverage = await getCategoryCoverage(config.target_language_code, categories);

  const rows = categories.map((categoryCode) => {
    const current = coverage[categoryCode] ?? 0;
    const target = getCategoryTargetWords(config, categoryCode);
    const missing = Math.max(0, target - current);
    return {
      target_language: config.target_language_code,
      category_code: categoryCode,
      current_words: current,
      target_words: target,
      missing_words: missing,
      done: missing === 0,
    };
  });

  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
