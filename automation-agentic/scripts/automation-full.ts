#!/usr/bin/env tsx
import { getCategoryCoverage, getCefrCoverage } from "../src/db/postgrest";
import { loadDotenv } from "../src/io/env";
import { ensureDirs } from "../src/io/paths";
import { helpText, parseCli } from "../src/pipeline/cli";
import { loadConfig } from "../src/pipeline/config";
import { runPipeline } from "../src/pipeline/runner";
import { CategoryConfig, CefrConfig, CefrLevel, CliOptions, PipelineConfig } from "../src/types";
import { getCategoryTargetWords } from "../src/pipeline/categorySettings";

function line() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

function title(message: string) {
  console.log(`\n🚀 ${message}`);
}

function info(message: string) {
  console.log(`ℹ️  ${message}`);
}

function success(message: string) {
  console.log(`✅ ${message}`);
}

function warn(message: string) {
  console.log(`⚠️  ${message}`);
}

function fail(message: string) {
  console.log(`❌ ${message}`);
}

function ensureDbEnv() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Full automation wymaga SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY, bo musi sprawdzać stan bazy i importować słowa.");
  }
}

function requiredLevel(cli: CliOptions, config: CefrConfig): CefrLevel {
  return cli.level ?? config.default_level;
}

function requiredCategory(cli: CliOptions, config: CategoryConfig): string {
  return cli.category ?? config.default_category;
}

function targetFor(config: PipelineConfig, cli: CliOptions) {
  if (config.mode === "cefr") {
    const cefrConfig = config as CefrConfig;
    const level = requiredLevel(cli, cefrConfig);
    const target = cefrConfig.targets[level];
    if (!target || target <= 0) throw new Error(`Brak targetu dla poziomu ${level} w config/cefr.json`);
    return { label: `CEFR ${level}`, key: level, level, category: undefined, target };
  }

  const categoryConfig = config as CategoryConfig;
  const category = requiredCategory(cli, categoryConfig);
  const target = getCategoryTargetWords(categoryConfig, category);
  if (!target || target <= 0) throw new Error(`Brak targetu dla kategorii ${category} w config/category.json`);
  return { label: `Category ${category}`, key: category, level: undefined, category, target };
}

async function loadTargetCount(config: PipelineConfig, target: ReturnType<typeof targetFor>): Promise<number> {
  if (config.mode === "cefr") {
    const coverage = await getCefrCoverage(config.target_language_code, [target.level as CefrLevel]);
    return coverage[target.level as CefrLevel] ?? 0;
  }

  const coverage = await getCategoryCoverage(config.target_language_code, [target.category as string]);
  return coverage[target.category as string] ?? 0;
}

function formatProgress(current: number, target: number) {
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
  return `${current}/${target} (${percent}%)`;
}

function fullHelpText() {
  return `${helpText()}\nFull automation:\n  npx tsx automation-agentic/scripts/automation-full.ts cefr --level B2 --import\n  npx tsx automation-agentic/scripts/automation-full.ts category --category travel --import\n\nWhat it does:\n  1. Checks current DB coverage for the selected CEFR level or category\n  2. Generates one batch sized to the remaining target\n  3. Imports it to Supabase\n  4. Checks DB coverage again\n  5. Repeats until target is reached\n\nCategory mode note:\n  - category excludes only lemmas already attached to that category\n  - existing DB lemmas can be selected and attached to the category without duplicating senses\n`;
}

async function main() {
  loadDotenv();
  ensureDirs();

  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0 || rawArgs.includes("--help") || rawArgs.includes("-h")) {
    console.log(fullHelpText());
    return;
  }

  const cli = parseCli(rawArgs);
  if (!cli.importLive) {
    throw new Error("Full automation musi dostać flagę --import, bo po każdym batchu sprawdza realny stan bazy. Dla testu pojedynczego batcha użyj automation.ts --dry-import.");
  }
  if (cli.skipDb) {
    throw new Error("Full automation nie może działać z --skip-db, bo baza jest źródłem prawdy dla coverage.");
  }

  ensureDbEnv();

  const config = loadConfig(cli.mode as any) as PipelineConfig;
  const target = targetFor(config, cli);
  const defaultBatchSize = cli.size ?? config.batch_size;
  const maxBatches = cli.maxBatches ?? Number.POSITIVE_INFINITY;
  let batchIndex = 0;
  let previousCount = await loadTargetCount(config, target);

  title(`Wordly Full Automation • ${target.label}`);
  info(`Cel: ${target.target} słów`);
  info(`Aktualny stan bazy: ${formatProgress(previousCount, target.target)}`);
  info(`Batch size: do ${defaultBatchSize} słów na rundę`);
  line();

  if (previousCount >= target.target) {
    success(`${target.label} jest już gotowe: ${formatProgress(previousCount, target.target)}. Nic nie generuję.`);
    return;
  }

  while (previousCount < target.target && batchIndex < maxBatches) {
    batchIndex += 1;
    const missingBefore = Math.max(0, target.target - previousCount);
    const currentBatchSize = Math.min(defaultBatchSize, missingBefore);

    title(`Runda ${batchIndex}`);
    info(`Stan przed rundą: ${formatProgress(previousCount, target.target)}`);
    info(`Brakuje jeszcze: ${missingBefore} słów`);
    info(`Teraz wygeneruję i zaimportuję maksymalnie ${currentBatchSize} pozycji dla ${target.label}.`);
    line();

    const report = await runPipeline(config, {
      ...cli,
      level: target.level,
      category: target.category,
      size: currentBatchSize,
      importLive: true,
      dryImport: false,
      skipDb: false,
      batch: undefined,
    });

    if (!report.validation.passed) {
      throw new Error(`Runda ${batchIndex} zatrzymana: batch nie przeszedł walidacji.`);
    }
    if (!report.import) {
      throw new Error(`Runda ${batchIndex} zatrzymana: import nie został wykonany.`);
    }
    if (report.import.errors.length > 0) {
      throw new Error(`Runda ${batchIndex} zatrzymana: import ma błędy: ${report.import.errors.join(" | ")}`);
    }

    const afterCount = await loadTargetCount(config, target);
    const added = Math.max(0, afterCount - previousCount);
    const missingAfter = Math.max(0, target.target - afterCount);

    line();
    success(`Runda ${batchIndex} zakończona.`);
    info(`Coverage increase w tej rundzie: ${added} słów`);
    info(`Stan po imporcie: ${formatProgress(afterCount, target.target)}`);
    info(`Zostało do celu: ${missingAfter} słów`);

    if (afterCount >= target.target) {
      success(`${target.label} gotowe: ${formatProgress(afterCount, target.target)} 🎉`);
      return;
    }

    if (added === 0) {
      throw new Error(`Runda ${batchIndex} nie zwiększyła coverage w bazie. Zatrzymuję autopilota, żeby nie robić pętli bez postępu.`);
    }

    previousCount = afterCount;
  }

  if (previousCount < target.target) {
    warn(`Zatrzymano po limicie rund --max-batches=${maxBatches}. Aktualny stan: ${formatProgress(previousCount, target.target)}.`);
    return;
  }

  success(`${target.label} gotowe: ${formatProgress(previousCount, target.target)} 🎉`);
}

main().catch((error) => {
  fail("Full automation stopped");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
