import { CEFR_LEVELS, CefrLevel, CliOptions, Mode } from "../types";

function readValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function has(args: string[], name: string) {
  return args.includes(name);
}

function normalizeMode(raw?: string): Mode {
  if (raw === "cefr") return "cefr";
  if (raw === "category") return "category";
  if (raw === "cateogry") return "category"; // common typo, intentionally supported
  throw new Error(`Unknown mode "${raw ?? ""}". Use: cefr or category.`);
}

function normalizeLevel(raw?: string): CefrLevel | undefined {
  if (!raw) return undefined;
  const upper = raw.toUpperCase() as CefrLevel;
  if (!CEFR_LEVELS.includes(upper)) throw new Error(`Invalid level "${raw}". Use: ${CEFR_LEVELS.join(", ")}`);
  return upper;
}

export function parseCli(argv = process.argv.slice(2)): CliOptions {
  const mode = normalizeMode(argv[0]);
  const sizeRaw = readValue(argv, "--size");
  const batchRaw = readValue(argv, "--batch");
  const maxBatchesRaw = readValue(argv, "--max-batches");

  return {
    mode,
    level: normalizeLevel(readValue(argv, "--level")),
    category: readValue(argv, "--category"),
    size: sizeRaw ? Number(sizeRaw) : undefined,
    batch: batchRaw ? Number(batchRaw) : undefined,
    maxBatches: maxBatchesRaw ? Number(maxBatchesRaw) : undefined,
    importLive: has(argv, "--import"),
    dryImport: has(argv, "--dry-import"),
    skipDb: has(argv, "--skip-db"),
    previewOnly: has(argv, "--preview-only"),
    verbose: has(argv, "--verbose"),
  };
}

export function helpText() {
  return `Wordly Agentic Automation

Usage:
  npx tsx automation-agentic/scripts/automation.ts cefr
  npx tsx automation-agentic/scripts/automation.ts cefr --level B2 --size 30
  npx tsx automation-agentic/scripts/automation.ts category --category business --size 30
  npx tsx automation-agentic/scripts/automation.ts cateogry --category business
  npx tsx automation-agentic/scripts/automation-full.ts category --category travel --import

Flags:
  --level A1|A2|B1|B2|C1|C2   CEFR level override
  --category business          Category override
  --size 30                    Lemma count
  --batch 2                    Batch number override
  --max-batches 1              Number of batches this run / full automation max rounds
  --dry-import                 Validate DB write plan without writes
  --import                     Write to Supabase after validation
  --skip-db                    Do not read Supabase coverage/existing lemmas
  --preview-only               Build files only from existing intermediate/final data if added later
  --verbose                    More console detail
`;
}
