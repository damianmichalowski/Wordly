import fs from "fs";
import path from "path";
import { callJsonModel } from "../agent/openai";
import { finalBatchSchema, lemmaPlanSchema, senseExplorerSchema } from "../agent/schemas";
import { UsageTracker } from "../agent/usage";
import { getCategoryCoverage, getCefrCoverage, importBatchToSupabase, loadExistingLemmas } from "../db/postgrest";
import { HumanLogger } from "../io/logger";
import { getPaths, safeRunId, slugForBatch } from "../io/paths";
import { writeJson, writeText } from "../io/json";
import { assembleFinalBatch } from "./assembler";
import { batchToCsv } from "./csv";
import { buildLemmaPlannerPrompt, buildRepairPrompt, buildSenseExplorerPrompt, LemmaSearchPressure } from "./prompts";
import { buildPreviewMarkdown } from "./preview";
import { polishSenseExplorerResult } from "./qualityGuard";
import { listGeneratedRegistryLemmas, recordGeneratedBatch, registryFilePath } from "../state/generatedLemmaRegistry";
import { addCandidateBankItems, candidateBankPath, loadCandidateBank, selectCandidatePlanFromBank } from "../state/candidateBank";
import { validateFinalBatch } from "../validation/validateBatch";
import { CategoryConfig, CefrConfig, CliOptions, FinalBatch, LemmaPlan, PipelineConfig, PipelineReport, SenseExplorerResult } from "../types";
import { getCategoryTargetWords } from "./categorySettings";

function now() {
  return new Date().toISOString();
}

function duration(start: number) {
  return Date.now() - start;
}

function countSenses(batch: FinalBatch) {
  return batch.entries.reduce((sum, entry) => sum + entry.senses.length, 0);
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffledCopy<T>(items: T[], seedText: string) {
  const result = [...items];
  const random = seededRandom(hashSeed(seedText));
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function shuffleFinalBatchEntries(batch: FinalBatch, seedText: string): FinalBatch {
  return { ...batch, entries: shuffledCopy(batch.entries ?? [], seedText) };
}

function initialPlannerPoolSize(requestedSize: number) {
  // Ask for a candidate pool larger than the final target.
  // Lemma planning is cheap; overplanning avoids expensive backfill rounds later.
  // Example: requested 30 -> planner returns 60 candidates, then code trims to the best 30 after dedupe/exclusions.
  if (requestedSize <= 0) return requestedSize;
  return Math.max(requestedSize + 30, Math.ceil(requestedSize * 2));
}

function backfillPlannerPoolSize(missing: number, requestedSize: number) {
  // Backfill must over-plan more aggressively than the final needed count.
  // The planner is cheap; the sense explorer is expensive and receives only accepted lemmas.
  // Example: missing 29 -> request 80+ candidates, filter, then explore only accepted lemmas.
  if (missing <= 0) return 0;
  return Math.min(90, Math.max(10, missing * 3, missing + 15, requestedSize));
}

function pressureRank(pressure: LemmaSearchPressure) {
  if (pressure === "exhaustive") return 3;
  if (pressure === "frontier") return 2;
  if (pressure === "expanded") return 1;
  return 0;
}

function cefrTargetCount(config: PipelineConfig, target: { level?: any }) {
  if (config.mode !== "cefr" || !target.level) return undefined;
  return (config as CefrConfig).targets?.[target.level as keyof CefrConfig["targets"]];
}

function categoryTargetCount(config: PipelineConfig, target: { category?: string }) {
  if (config.mode !== "category" || !target.category) return undefined;
  return getCategoryTargetWords(config as CategoryConfig, target.category);
}

function targetCount(config: PipelineConfig, target: { level?: any; category?: string }) {
  return config.mode === "cefr" ? cefrTargetCount(config, target) : categoryTargetCount(config, target);
}

function lemmaSearchPressure(config: PipelineConfig, target: { level?: any; category?: string }, activeCount: number): LemmaSearchPressure {
  const countTarget = targetCount(config, target);
  if (!countTarget) return "normal";

  const current = Math.max(0, activeCount || 0);
  const remaining = Math.max(0, countTarget - current);
  const coverage = current / countTarget;

  // Pressure is based on coverage of the CURRENT target (CEFR level or category),
  // not on the global exclusion list. This keeps generation adaptive near the target.
  if (remaining <= 10 || coverage >= 0.96) return "exhaustive";
  if (remaining <= 25 || coverage >= 0.85) return "frontier";
  if (coverage >= 0.62) return "expanded";
  return "normal";
}

function candidateReserveTarget(params: { requestedSize: number; level?: any; existingCount: number; searchPressure?: LemmaSearchPressure }) {
  const envOverride = Number(process.env.WORDLY_CANDIDATE_RESERVE_TARGET ?? 0);
  if (Number.isFinite(envOverride) && envOverride >= params.requestedSize) return Math.floor(envOverride);

  const level = String(params.level ?? "").toUpperCase();
  const isBasicTail = level === "A1" || level === "A2";
  const rank = pressureRank(params.searchPressure ?? "normal");

  // Keep a useful reserve, but do not force hundreds of extra candidates too early.
  // Old behavior used global exclusions and often targeted ~330 candidates at 60-80% coverage,
  // causing 8-14 refill calls. These targets are enough for stable 30-word batches.
  const multipliers = isBasicTail ? [3.0, 4.0, 5.25, 6.5] : [2.5, 3.5, 4.75, 6.0];
  const floors = isBasicTail ? [90, 130, 180, 240] : [70, 105, 145, 190];

  return Math.ceil(Math.max(params.requestedSize * (multipliers[rank] ?? 2.5), floors[rank] ?? 70));
}

function candidateRefillAttemptPoolSize(params: { shortage: number; level?: any; existingCount: number; attempt: number; searchPressure?: LemmaSearchPressure }) {
  const envOverride = Number(process.env.WORDLY_CANDIDATE_REFILL_CHUNK ?? 0);
  if (Number.isFinite(envOverride) && envOverride >= 20) return Math.min(160, Math.floor(envOverride));

  const level = String(params.level ?? "").toUpperCase();
  const isBasicTail = level === "A1" || level === "A2";
  const rank = pressureRank(params.searchPressure ?? "normal");

  const floors = isBasicTail ? [45, 60, 80, 100] : [40, 55, 70, 90];
  const caps = isBasicTail ? [70, 85, 105, 130] : [60, 75, 95, 120];
  const multiplier = [1.2, 1.45, 1.8, 2.15][rank] ?? 1.2;
  const attemptBoost = 1 + Math.max(0, params.attempt - 1) * 0.05;

  return Math.min(caps[rank] ?? 60, Math.ceil(Math.max(floors[rank] ?? 40, params.shortage * multiplier) * attemptBoost));
}

function candidateReserveMaxAttempts(params: { level?: any; existingCount: number; searchPressure?: LemmaSearchPressure }) {
  const rank = pressureRank(params.searchPressure ?? "normal");
  const envOverride = Number(process.env.WORDLY_CANDIDATE_REFILL_MAX_ATTEMPTS ?? 0);
  if (Number.isFinite(envOverride) && envOverride >= 1) return Math.floor(envOverride);

  if (rank >= 3) return 8;
  if (rank >= 2) return 6;
  if (rank >= 1) return 4;
  return 3;
}

function candidateRefillMaxOutputTokens(poolSize: number) {
  // Small candidate chunks should comfortably close structured JSON.
  return Math.max(10000, Math.min(18000, poolSize * 130));
}

function isIncompleteOutputError(error: unknown) {
  return error instanceof Error && error.message.includes("OpenAI response incomplete");
}

function compactPromptExclusions(lemmas: string[], limit = 450) {
  // Full exclusion is always enforced by code. The prompt only needs a warning sample.
  const clean = Array.from(new Set(lemmas.map((lemma) => normalizeLemmaKey(lemma)).filter(Boolean)));
  if (clean.length <= limit) return clean;
  const head = Math.floor(limit * 0.35);
  const tail = limit - head;
  return [...clean.slice(0, head), ...clean.slice(-tail)];
}

function getExistingLocal(paths: ReturnType<typeof getPaths>, mode: string, key: string) {
  const cacheFile = path.join(paths.cache, `existing-${mode}-${key}.txt`);
  if (!fs.existsSync(cacheFile)) return [];
  return fs.readFileSync(cacheFile, "utf-8").split(/\r?\n/).map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function saveExistingLocal(paths: ReturnType<typeof getPaths>, mode: string, key: string, lemmas: string[]) {
  const cacheFile = path.join(paths.cache, `existing-${mode}-${key}.txt`);
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, `${Array.from(new Set(lemmas)).sort().join("\n")}\n`, "utf-8");
}

type CandidateReserveStats = {
  attempts: number;
  added: number;
  rejectedInvalidOrDuplicate: number;
  rejectedExcluded: number;
  durationMs: number;
};

async function ensureCandidateBankReserve(params: {
  paths: ReturnType<typeof getPaths>;
  config: PipelineConfig;
  target: { level?: any; category?: string; key: string };
  batch: number;
  requestedSize: number;
  excluded: string[];
  reserveTarget: number;
  searchPressure?: LemmaSearchPressure;
  levelTarget?: number;
  levelActiveCount?: number;
  runDir: string;
  usage: UsageTracker;
  logger: HumanLogger;
  source: "planner_refill" | "backfill_refill";
  stepPrefix: string;
}) {
  const reserveStarted = Date.now();
  const stats: CandidateReserveStats = {
    attempts: 0,
    added: 0,
    rejectedInvalidOrDuplicate: 0,
    rejectedExcluded: 0,
    durationMs: 0,
  };

  let selection = selectCandidatePlanFromBank({
    paths: params.paths,
    config: params.config,
    target: params.target,
    batch: params.batch,
    excluded: params.excluded,
    limit: params.requestedSize,
  });

  const searchPressure = params.searchPressure ?? lemmaSearchPressure(params.config, params.target, params.levelActiveCount ?? 0);
  const levelTarget = params.levelTarget ?? targetCount(params.config, params.target);

  const maxAttempts = candidateReserveMaxAttempts({
    level: params.target.level,
    existingCount: params.levelActiveCount ?? params.excluded.length,
    searchPressure,
  });

  for (let attempt = 1; selection.availableCount < params.reserveTarget && attempt <= maxAttempts; attempt++) {
    stats.attempts += 1;
    const shortage = params.reserveTarget - selection.availableCount;
    const poolSize = candidateRefillAttemptPoolSize({
      shortage,
      level: params.target.level,
      existingCount: params.levelActiveCount ?? params.excluded.length,
      attempt,
      searchPressure,
    });

    const bank = loadCandidateBank(params.paths, params.config, params.target);
    const bankLemmas = bank.candidates.map((item) => item.lemma);
    const codeExcluded = Array.from(new Set([...params.excluded, ...bankLemmas].map(normalizeLemmaKey).filter(Boolean)));

    params.logger.detail(
      `${params.stepPrefix}: refill ${attempt}/${maxAttempts} • dostępne=${selection.availableCount}/${params.reserveTarget} • pool=${poolSize} • mode=${searchPressure}`
    );

    const plannerPrompt = buildLemmaPlannerPrompt({
      config: params.config,
      level: params.target.level,
      category: params.target.category,
      batch: params.batch,
      size: poolSize,
      excluded: compactPromptExclusions(codeExcluded),
      searchPressure,
      existingCount: params.levelActiveCount ?? params.excluded.length,
      levelTarget,
    });

    let planCall;
    try {
      planCall = await callJsonModel<LemmaPlan>({
        step: `${params.stepPrefix}_reserve_${attempt}`.replace(/[^a-z0-9_]+/gi, "_"),
        model: params.config.models.lemma_planner,
        system: plannerPrompt.system,
        user: plannerPrompt.user,
        maxOutputTokens: candidateRefillMaxOutputTokens(poolSize),
        prices: params.config.prices_per_1m_tokens,
        schemaName: `wordly_${params.config.mode}_${params.stepPrefix}_reserve_${attempt}`.replace(/[^a-z0-9_]+/gi, "_"),
        schema: lemmaPlanSchema(params.config.mode),
        rawResponsePath: path.join(params.runDir, `raw-${params.stepPrefix}-${attempt}-candidate-reserve-response.json`),
      });
    } catch (error) {
      if (isIncompleteOutputError(error)) {
        params.logger.warn(`${params.stepPrefix}: refill ${attempt}/${maxAttempts} nie domknął JSON. Pomijam tę próbę.`);
        continue;
      }
      throw error;
    }
    params.usage.add(planCall.usage);
    params.logger.usage(planCall.usage);

    let refillPlan = normalizePlan(planCall.data, params.config, params.target, params.batch);
    const rawCount = refillPlan.lemmas.length;
    refillPlan = capAndDedupePlan(refillPlan, poolSize);
    const afterShapeCount = refillPlan.lemmas.length;
    const filteredPlan = filterUnusedPlanLemmas(refillPlan, codeExcluded, poolSize);
    const droppedByShape = rawCount - afterShapeCount;
    const droppedByExclusion = afterShapeCount - filteredPlan.lemmas.length;

    stats.rejectedInvalidOrDuplicate += Math.max(0, droppedByShape);
    stats.rejectedExcluded += Math.max(0, droppedByExclusion);

    params.logger.detail(
      `${params.stepPrefix}: refill ${attempt} wynik • raw=${rawCount}, po filtrach=${filteredPlan.lemmas.length}, odrzucone=${droppedByShape + droppedByExclusion}`
    );

    writeJson(path.join(params.runDir, `${params.stepPrefix}-${attempt}-candidate-reserve.json`), filteredPlan);

    const update = addCandidateBankItems({
      paths: params.paths,
      config: params.config,
      target: params.target,
      items: filteredPlan.lemmas,
      excluded: params.excluded,
      source: params.source,
    });

    stats.added += update.added;

    selection = selectCandidatePlanFromBank({
      paths: params.paths,
      config: params.config,
      target: params.target,
      batch: params.batch,
      excluded: params.excluded,
      limit: params.requestedSize,
    });

    params.logger.detail(
      `${params.stepPrefix}: bank update • +${update.added}, dostępne=${selection.availableCount}/${params.reserveTarget}, bank=${update.total}`
    );
  }

  stats.durationMs = Date.now() - reserveStarted;
  return { ...selection, reserveStats: stats };
}

function nextBatchNumber(paths: ReturnType<typeof getPaths>, prefix: string) {
  const files = fs.existsSync(paths.json) ? fs.readdirSync(paths.json) : [];
  const re = new RegExp(`^${prefix.toLowerCase()}_(\\d{3})\\.json$`, "i");
  const nums = files.map((file) => file.match(re)?.[1]).filter((v): v is string => Boolean(v)).map(Number);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function resolveRunTarget(config: PipelineConfig, cli: CliOptions) {
  if (config.mode === "cefr") {
    const cefr = config as CefrConfig;
    const level = cli.level ?? cefr.default_level;
    return { level, category: undefined, key: level.toLowerCase() };
  }
  const categoryConfig = config as CategoryConfig;
  const category = cli.category ?? categoryConfig.default_category;
  return { level: undefined, category, key: category.toLowerCase() };
}



function resolveExclusionCacheKey(config: PipelineConfig, target: { level?: any; category?: string; key: string }) {
  // CEFR dedupe is global per target language, not per level.
  // Local cache is fallback only; DB remains the source of truth when available.
  if (config.mode === "cefr") return `all-${config.target_language_code}`;
  return target.key;
}



const ALLOWED_MULTIWORD_LEMMAS = new Set([
  "give up",
  "look after",
  "look for",
  "put off",
  "set up",
  "carry out",
  "turn on",
  "turn off",
  "take off",
  "deal with",
  "depend on",
  "focus on",
  "point out",
  "find out",
  "work out",
  "break down",
  "bring up",
  "come across",
]);

const KNOWN_BAD_GENERATED_LEMMAS = new Set([
  "accessibleable",
  "approveable",
  "availablely",
  "communicateable",
  "controlable",
  "createable",
  "describeable",
  "estimateable",
  "explaination",
  "includeable",
  "negotiateable",
  "prepareable",
  "procedureal",
  "availableto",
  "arriveat",
  "arriveback",
  "arriveby",
  "arrivehome",
  "arrivein",
  "attendmeeting",
  "bankaccount",
  "bookingoffice",
  "chargephone",
  "claimantinfo",
  "complaintform",
  "confirmingnote",
  "createaccount",
  "damageclaim",
  "deadlineextension",
  "dealwith",
  "deliverableitem",
  "earningsreport",
  "estimatecost",
  "estimatevalue",
  "feedbackform",
  "meetingplace",
  "mentionabletest",
  "arriveer",
  "receiveable",
  "replyable",
  "handlewith",
  "hangon",
  "installmentplan",
  "invoiceid",
  "issuecard",
  "issuecode",
  "meetingroom",
  "membershipcard",
  "offercode",
  "policyholderinfo",
  "repairshop",
  "savefile",
  "tastegood",
]);

const GENERATED_ABLE_LEMMAS_TO_REJECT = new Set([
  "announceable",
  "appointable",
  "arriveable",
  "attemptable",
  "attendable",
  "boostable",
  "claimable",
  "communicateable",
  "confirmable",
  "consentable",
  "contactable",
  "contestable",
  "exchangeable",
  "denyable",
  "discussable",
  "earnable",
  "estimateable",
  "experienceable",
  "feedbackable",
  "handleable",
  "influenceable",
  "chargeable",
  "explainable",
  "invoiceable",
  "issueable",
  "maintainable",
  "mentionable",
  "postponeable",
  "repairable",
  "requestable",
  "searchable",
  "serviceable",
  "surveyable",
]);

const GLUED_COMPOUND_FALSE_POSITIVES = new Set([
  "cellphone",
  "smartphone",
  "telephone",
  "headphone",
  "headphones",
  "info",
  "note",
  "perform",
  "inform",
  "reform",
  "uniform",
  "platform",
  "timetable",
]);

function isLikelyGluedGeneratedCompound(lemma: string) {
  const normalized = normalizeLemmaKey(lemma).replace(/[\s-]/g, "");
  if (GLUED_COMPOUND_FALSE_POSITIVES.has(normalized)) return false;
  return /^[a-z]{3,}(account|form|info|plan|card|phone|note|code|office|room|report|shop)$/.test(normalized);
}

function normalizeLemmaKey(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyOrdinaryPrepositionCollocation(lemma: string) {
  const normalized = normalizeLemmaKey(lemma);
  if (!normalized.includes(" ")) return false;
  if (ALLOWED_MULTIWORD_LEMMAS.has(normalized)) return false;

  const ordinaryEnding = /\b(with|about|for|from|to|of|on|in|at|by|into|onto)$/;
  return ordinaryEnding.test(normalized);
}

function isLikelyGluedPrepositionLemma(lemma: string) {
  const normalized = normalizeLemmaKey(lemma).replace(/\s+/g, "");
  return /^(submit|apply|respond|refer|negotiate|complain|request|listen|agree|contribute|participate|depend|rely|object|appeal|subscribe|belong)(to|with|about|for|from|on|in|at|by|of)$/.test(normalized);
}

function isInvalidGeneratedLemma(lemma: string) {
  const normalized = normalizeLemmaKey(lemma);
  if (!normalized) return true;
  if (/[^a-z\- '\s]/i.test(normalized)) return true;
  if (normalized.includes("replaced")) return true;
  if (KNOWN_BAD_GENERATED_LEMMAS.has(normalized)) return true;
  if (GENERATED_ABLE_LEMMAS_TO_REJECT.has(normalized)) return true;
  if (normalized === "planing") return true;
  if (isLikelyGluedGeneratedCompound(normalized)) return true;
  if (isLikelyGluedPrepositionLemma(normalized)) return true;
  if (isLikelyOrdinaryPrepositionCollocation(normalized)) return true;

  // In this CEFR/core generator, multi-word lemmas are allowed only when explicitly known as lexical/phrasal.
  // This blocks broken words like "asses sment" and ordinary collocations like "submit to".
  if (normalized.includes(" ") && !ALLOWED_MULTIWORD_LEMMAS.has(normalized)) return true;

  return false;
}

function capAndDedupePlan(plan: LemmaPlan, requestedSize: number): LemmaPlan {
  const seen = new Set<string>();
  const lemmas: LemmaPlan["lemmas"] = [];

  for (const item of plan.lemmas ?? []) {
    const lemma = normalizeLemmaKey(String(item.lemma ?? ""));
    if (isInvalidGeneratedLemma(lemma) || seen.has(lemma)) continue;
    seen.add(lemma);
    lemmas.push({ ...item, lemma });
    if (lemmas.length >= requestedSize) break;
  }

  return { ...plan, lemmas };
}

function filterUnusedPlanLemmas(plan: LemmaPlan, usedLemmas: Iterable<string>, limit: number): LemmaPlan {
  const used = new Set(Array.from(usedLemmas).map((lemma) => normalizeLemmaKey(lemma)));
  const seen = new Set<string>();
  const lemmas: LemmaPlan["lemmas"] = [];

  for (const item of plan.lemmas ?? []) {
    const lemma = normalizeLemmaKey(String(item.lemma ?? ""));
    if (isInvalidGeneratedLemma(lemma) || used.has(lemma) || seen.has(lemma)) continue;
    seen.add(lemma);
    lemmas.push({ ...item, lemma });
    if (lemmas.length >= limit) break;
  }

  return { ...plan, lemmas };
}

function dedupeAndCleanFinalBatch(batch: FinalBatch, requestedSize?: number): FinalBatch {
  const byLemma = new Map<string, FinalBatch["entries"][number]>();

  for (const entry of batch.entries ?? []) {
    const lemma = normalizeLemmaKey(entry.lemma);
    if (isInvalidGeneratedLemma(lemma)) continue;
    const normalizedEntry = { ...entry, lemma };
    const previous = byLemma.get(lemma);
    if (!previous || normalizedEntry.senses.length > previous.senses.length) {
      byLemma.set(lemma, normalizedEntry);
    }
  }

  const entries = Array.from(byLemma.values()).slice(0, requestedSize ?? batch.entries.length);
  return { ...batch, entries };
}

function mergeFinalBatches(base: FinalBatch, extra: FinalBatch, requestedSize: number): FinalBatch {
  const merged = dedupeAndCleanFinalBatch({ ...base, entries: [...base.entries, ...(extra.entries ?? [])] }, requestedSize);
  return merged;
}

function normalizePlan(plan: LemmaPlan, config: PipelineConfig, target: { level?: any; category?: string }, batch: number): LemmaPlan {
  return {
    target_language: config.target_language,
    source_language: config.source_language,
    ...(config.mode === "cefr" ? { level: target.level } : { category: target.category }),
    batch,
    lemmas: (plan.lemmas ?? []).map((item) => ({
      lemma: normalizeLemmaKey(String(item.lemma ?? "")),
      ipa: String(item.ipa ?? "").trim(),
      level: config.mode === "cefr" ? target.level : item.level,
    })).filter((item) => item.lemma && item.ipa && item.level),
  };
}

export async function runPipeline(config: PipelineConfig, cli: CliOptions) {
  const paths = getPaths();
  const runId = safeRunId();
  const runStarted = Date.now();
  const startedAt = now();
  const usage = new UsageTracker();
  const logFile = path.join(paths.reports, `agentic-${runId}.log`);
  const logger = new HumanLogger(logFile, cli.verbose);
  const target = resolveRunTarget(config, cli);
  let requestedSize = cli.size ?? config.batch_size;
  let plannerPoolSize = initialPlannerPoolSize(requestedSize);
  const batchNumber = cli.batch ?? nextBatchNumber(paths, target.key);
  const slug = slugForBatch({ mode: config.mode, level: target.level, category: target.category, batch: batchNumber });
  const runDir = path.join(paths.intermediate, `${slug}-${runId}`);
  fs.mkdirSync(runDir, { recursive: true });

  logger.title("Wordly Agentic Automation v2.5");
  logger.info(`${config.mode === "cefr" ? `CEFR ${target.level}` : `Category ${target.category}`} • ${config.target_language} → ${config.source_language} • batch ${batchNumber} • size ${requestedSize}`);
  logger.detail(`Planner pool=${plannerPoolSize}`);
  logger.detail(`Modele: planner=${config.models.lemma_planner}, senses=${config.models.sense_explorer}, repair=${config.models.json_repair}`);

  const exclusionCacheKey = resolveExclusionCacheKey(config, target);
  let existing: string[] = [];
  let levelActiveCount: number | undefined;
  let categoryActiveCount: number | undefined;

  if (!cli.skipDb) {
    logger.step("0/3 DB context");
    existing = await loadExistingLemmas({
      mode: config.mode,
      targetLanguageCode: config.target_language_code,
      level: target.level,
      category: target.category,
    }).catch((error) => {
      logger.warn(`DB exclusions fallback: używam lokalnego cache. ${error instanceof Error ? error.message : String(error)}`);
      return [];
    });

    if (config.mode === "cefr" && target.level) {
      const coverage = await getCefrCoverage(config.target_language_code, [target.level]).catch((error) => {
        logger.warn(`Nie udało się pobrać coverage ${target.level}: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
      });
      levelActiveCount = coverage?.[target.level];
    }

    if (config.mode === "category" && target.category) {
      const coverage = await getCategoryCoverage(config.target_language_code, [target.category]).catch((error) => {
        logger.warn(`Nie udało się pobrać coverage kategorii ${target.category}: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
      });
      categoryActiveCount = coverage?.[target.category];
    }

    if (existing.length) saveExistingLocal(paths, config.mode, exclusionCacheKey, existing);
  }

  if (!existing.length) existing = getExistingLocal(paths, config.mode, exclusionCacheKey);

  const registryLemmas = listGeneratedRegistryLemmas({
    paths,
    targetLanguage: config.target_language,
    mode: config.mode,
    category: target.category,
  });

  const exclusionSet = new Set([...existing, ...registryLemmas].map((lemma) => lemma.trim().toLowerCase()).filter(Boolean));
  existing = Array.from(exclusionSet);

  const levelTarget = targetCount(config, target);
  const activeCountForTarget = config.mode === "cefr" ? (levelActiveCount ?? 0) : (categoryActiveCount ?? 0);
  const levelCountForPressure = levelTarget === undefined ? existing.length : activeCountForTarget;
  const searchPressure = lemmaSearchPressure(config, target, levelCountForPressure);
  const remainingForLevel = levelTarget === undefined ? undefined : Math.max(0, levelTarget - activeCountForTarget);

  if (config.mode === "category" && levelTarget !== undefined && remainingForLevel !== undefined && remainingForLevel <= 0) {
    logger.success(`Category ${target.category} coverage: ${activeCountForTarget}/${levelTarget} (100%) • target already done.`);
    logger.info(`Nie generuję nowego batcha, bo kategoria osiągnęła target.`);
    logger.save();
    throw new Error(`Category ${target.category} already reached target ${levelTarget}.`);
  }

  if (config.mode === "category" && levelTarget !== undefined && remainingForLevel !== undefined && requestedSize > remainingForLevel) {
    requestedSize = remainingForLevel;
    plannerPoolSize = initialPlannerPoolSize(requestedSize);
    logger.info(`Category target guard: zmniejszam size do remaining=${requestedSize}, żeby nie przebić targetu.`);
  }

  if (config.mode === "cefr" && levelTarget !== undefined && levelActiveCount !== undefined) {
    const percent = Math.min(100, Math.round((levelActiveCount / levelTarget) * 100));
    logger.success(`${target.level} coverage: ${levelActiveCount}/${levelTarget} (${percent}%) • zostało ${remainingForLevel}`);
    logger.info(`Exclusions: ${existing.length} global lemma (DB/cache + registry ${registryLemmas.length}) • search=${searchPressure}`);
  } else if (config.mode === "category" && levelTarget !== undefined && categoryActiveCount !== undefined) {
    const percent = Math.min(100, Math.round((categoryActiveCount / levelTarget) * 100));
    logger.success(`Category ${target.category} coverage: ${categoryActiveCount}/${levelTarget} (${percent}%) • zostało ${remainingForLevel}`);
    logger.info(`Exclusions: ${existing.length} lemma already attached to this category (DB/cache + category registry ${registryLemmas.length}) • search=${searchPressure}`);
  } else {
    logger.success(`Exclusions: ${existing.length} lemma (DB/cache + registry ${registryLemmas.length}) • search=${searchPressure}`);
  }
  logger.detail(`Local registry: ${registryFilePath(paths)}`);
  logger.detail(`Candidate bank: ${candidateBankPath(paths, config, target)}`);

  logger.step("1/3 Lemma selection");

  const initialReserveTarget = candidateReserveTarget({
    requestedSize,
    level: target.level,
    existingCount: levelCountForPressure,
    searchPressure,
  });

  const bankSelection = await ensureCandidateBankReserve({
    paths,
    config,
    target,
    batch: batchNumber,
    requestedSize,
    excluded: existing,
    reserveTarget: initialReserveTarget,
    searchPressure,
    levelTarget,
    levelActiveCount: activeCountForTarget,
    runDir,
    usage,
    logger,
    source: "planner_refill",
    stepPrefix: "lemma_candidate_bank",
  });

  let plan = normalizePlan(bankSelection.plan, config, target, batchNumber);

  const reserveStats = bankSelection.reserveStats;
  if (plan.lemmas.length >= requestedSize) {
    logger.success(`Lemma plan: ${plan.lemmas.length}/${requestedSize} wybrane • bank available=${bankSelection.availableCount}/${initialReserveTarget}`);
  } else {
    logger.warn(`Lemma plan: tylko ${plan.lemmas.length}/${requestedSize} dostępnych • bank available=${bankSelection.availableCount}/${initialReserveTarget}. Spróbuję backfill.`);
  }
  if (reserveStats.attempts > 0) {
    logger.info(`Reserve refill: ${reserveStats.attempts} prób • +${reserveStats.added} nowych • odrzucone=${reserveStats.rejectedInvalidOrDuplicate + reserveStats.rejectedExcluded}`);
  } else {
    logger.info(`Reserve refill: niepotrzebny`);
  }

  writeJson(path.join(runDir, "01-lemma-plan.json"), plan);

  logger.step("2/3 Sense explorer");

  let polished: ReturnType<typeof polishSenseExplorerResult>;

  if (plan.lemmas.length === 0) {
    logger.warn("Planner po filtrach nie zostawił żadnych nowych lemma. Pomijam sense_explorer i przechodzę od razu do backfill, żeby nie przepalać tokenów.");
    const emptySenseResult: SenseExplorerResult = {
      target_language: config.target_language,
      source_language: config.source_language,
      ...(config.mode === "cefr" ? { level: target.level } : { category: target.category }),
      batch: batchNumber,
      entries: [],
    };
    polished = { result: emptySenseResult, fixes: [] };
    writeJson(path.join(runDir, "02-sense-candidates.raw.json"), emptySenseResult);
    writeJson(path.join(runDir, "02b-sense-candidates-polished.json"), emptySenseResult);
    writeJson(path.join(runDir, "02b-quality-fixes.json"), []);
    logger.success("Quality polish pass • bez poprawek");
  } else {
    const sensePrompt = buildSenseExplorerPrompt({ config, plan, category: target.category });
    const sensesCall = await callJsonModel<SenseExplorerResult>({
      step: "sense_explorer",
      model: config.models.sense_explorer,
      system: sensePrompt.system,
      user: sensePrompt.user,
      maxOutputTokens: Math.max(8000, plan.lemmas.length * 520),
      prices: config.prices_per_1m_tokens,
      schemaName: `wordly_${config.mode}_sense_explorer`,
      schema: senseExplorerSchema(config.mode),
      rawResponsePath: path.join(runDir, "raw-02-sense-explorer-response.json"),
    });
    usage.add(sensesCall.usage);
    logger.usage(sensesCall.usage);
    writeJson(path.join(runDir, "02-sense-candidates.raw.json"), sensesCall.data);

    polished = polishSenseExplorerResult(sensesCall.data);
    writeJson(path.join(runDir, "02b-sense-candidates-polished.json"), polished.result);
    writeJson(path.join(runDir, "02b-quality-fixes.json"), polished.fixes);
    const candidateCount = polished.result.entries.reduce((sum, entry) => sum + entry.candidates.length, 0);
    logger.success(`Senses: ${polished.result.entries.length} lemma → ${candidateCount} candidates • polish fixes=${polished.fixes.length}`);
  }

  logger.step("3/3 Validate, export, import");
  let finalBatch = assembleFinalBatch({
    config,
    plan,
    explored: polished.result,
    maxFinalSenses: config.limits.max_final_senses_per_lemma,
  });
  finalBatch = dedupeAndCleanFinalBatch(finalBatch, requestedSize);
  let validation = validateFinalBatch(finalBatch);

  const rejectedThisRun = new Set<string>();

  const maxBackfillRounds = searchPressure === "exhaustive" ? 10 : searchPressure === "frontier" ? 8 : 5;

  for (let backfillRound = 1; finalBatch.entries.length < requestedSize && backfillRound <= maxBackfillRounds; backfillRound++) {
    const missing = requestedSize - finalBatch.entries.length;
    logger.warn(`Finalny batch ma ${finalBatch.entries.length}/${requestedSize} entry po filtrach. Dogenerowuję brakujące: ${missing} (round ${backfillRound}/${maxBackfillRounds}).`);

    const usedLemmas = [
      ...existing,
      ...plan.lemmas.map((item) => item.lemma),
      ...finalBatch.entries.map((entry) => entry.lemma),
      ...Array.from(rejectedThisRun),
    ];

    const backfillNeeded = missing;
    const backfillSearchPressure = searchPressure;
    const backfillReserveTargetRaw = candidateReserveTarget({
      requestedSize,
      level: target.level,
      existingCount: levelCountForPressure,
      searchPressure: backfillSearchPressure,
    });
    const backfillReserveCap = backfillSearchPressure === "exhaustive"
      ? Math.max(requestedSize * 4, backfillNeeded * 12, 120)
      : backfillSearchPressure === "frontier"
        ? Math.max(requestedSize * 3, backfillNeeded * 8, 90)
        : Math.max(requestedSize, backfillNeeded * 4);
    const backfillReserveTarget = Math.max(backfillNeeded, Math.min(backfillReserveTargetRaw, backfillReserveCap));

    const backfillSelection = await ensureCandidateBankReserve({
      paths,
      config,
      target,
      batch: batchNumber,
      requestedSize: backfillNeeded,
      excluded: usedLemmas,
      reserveTarget: backfillReserveTarget,
      searchPressure: backfillSearchPressure,
      levelTarget,
      levelActiveCount: activeCountForTarget,
      runDir,
      usage,
      logger,
      source: "backfill_refill",
      stepPrefix: `lemma_backfill_${backfillRound}_bank`,
    });

    let backfillPlan = normalizePlan(backfillSelection.plan, config, target, batchNumber);

    if (backfillPlan.lemmas.length >= backfillNeeded) {
      logger.info(`Backfill ${backfillRound}: biorę ${backfillPlan.lemmas.length} lemma z candidate bank bez małych refillów • dostępne=${backfillSelection.availableCount}, reserve=${backfillReserveTarget}`);
    } else {
      logger.warn(`Backfill ${backfillRound}: bank po reserve-build ma tylko ${backfillPlan.lemmas.length}/${backfillNeeded} lemma • dostępne=${backfillSelection.availableCount}, reserve=${backfillReserveTarget}.`);
    }

    backfillPlan = capAndDedupePlan(backfillPlan, backfillNeeded);
    writeJson(path.join(runDir, `04-${backfillRound}-lemma-backfill.json`), backfillPlan);

    if (!backfillPlan.lemmas.length) {
      logger.warn(`Backfill ${backfillRound}: candidate bank/planner nie dostarczył nowych lemma po dedupe. Próbuję dalej, aż do limitu rund.`);
      continue;
    }

    for (const item of backfillPlan.lemmas) rejectedThisRun.add(item.lemma);

    const backfillSensePrompt = buildSenseExplorerPrompt({ config, plan: backfillPlan, category: target.category });
    const backfillSensesCall = await callJsonModel<SenseExplorerResult>({
      step: `sense_backfill_${backfillRound}`,
      model: config.models.sense_explorer,
      system: backfillSensePrompt.system,
      user: backfillSensePrompt.user,
      maxOutputTokens: Math.max(3500, backfillPlan.lemmas.length * 520),
      prices: config.prices_per_1m_tokens,
      schemaName: `wordly_${config.mode}_sense_backfill_${backfillRound}`,
      schema: senseExplorerSchema(config.mode),
      rawResponsePath: path.join(runDir, `raw-05-${backfillRound}-sense-backfill-response.json`),
    });
    usage.add(backfillSensesCall.usage);
    logger.usage(backfillSensesCall.usage);
    writeJson(path.join(runDir, `05-${backfillRound}-sense-backfill.raw.json`), backfillSensesCall.data);

    const polishedBackfill = polishSenseExplorerResult(backfillSensesCall.data);
    writeJson(path.join(runDir, `05b-${backfillRound}-sense-backfill-polished.json`), polishedBackfill.result);
    writeJson(path.join(runDir, `05b-${backfillRound}-quality-fixes.json`), polishedBackfill.fixes);
    if (polishedBackfill.fixes.length > 0) logger.success(`Backfill ${backfillRound}: quality polish pass • drobne poprawki=${polishedBackfill.fixes.length}`);

    const backfillBatch = assembleFinalBatch({
      config,
      plan: backfillPlan,
      explored: polishedBackfill.result,
      maxFinalSenses: config.limits.max_final_senses_per_lemma,
    });
    writeJson(path.join(runDir, `06-${backfillRound}-final-backfill.json`), backfillBatch);

    const before = finalBatch.entries.length;
    finalBatch = mergeFinalBatches(finalBatch, backfillBatch, requestedSize);
    logger.success(`Backfill ${backfillRound}: dodano ${finalBatch.entries.length - before} entry • ${finalBatch.entries.length}/${requestedSize}`);
  }

  validation = validateFinalBatch(finalBatch);
  if (finalBatch.entries.length !== requestedSize) {
    validation = {
      ...validation,
      passed: false,
      errors: [
        ...validation.errors,
        `Final batch size mismatch: expected ${requestedSize}, got ${finalBatch.entries.length}. Backfill did not reach target size.`,
      ],
    };
  }

  const autoRepairEnabled = process.env.WORDLY_ENABLE_FINAL_JSON_REPAIR === "true";

  if (!validation.passed && finalBatch.entries.length === requestedSize) {
    if (autoRepairEnabled) {
      logger.warn(`Walidacja znalazła ${validation.errors.length} błędów. WORDLY_ENABLE_FINAL_JSON_REPAIR=true, więc próbuję ostrożny repair.`);
      writeJson(path.join(runDir, "03a-final-batch-before-repair.json"), finalBatch);
      const validationBeforeRepair = validation;
      const repairPrompt = buildRepairPrompt({ config, jsonText: JSON.stringify(finalBatch), errors: validation.errors });
      const repairCall = await callJsonModel<FinalBatch>({
        step: "json_repair",
        model: config.models.json_repair,
        system: repairPrompt.system,
        user: repairPrompt.user,
        maxOutputTokens: Math.max(8000, requestedSize * 450),
        prices: config.prices_per_1m_tokens,
        schemaName: `wordly_${config.mode}_final_batch_repair`,
        schema: finalBatchSchema(config.mode),
        rawResponsePath: path.join(runDir, "raw-03-json-repair-response.json"),
      });
      usage.add(repairCall.usage);
      logger.usage(repairCall.usage);

      const repairedBatch = dedupeAndCleanFinalBatch(repairCall.data, requestedSize);
      let repairedValidation = validateFinalBatch(repairedBatch);
      if (repairedBatch.entries.length !== requestedSize) {
        repairedValidation = {
          ...repairedValidation,
          passed: false,
          errors: [
            ...repairedValidation.errors,
            `Final batch size mismatch after repair: expected ${requestedSize}, got ${repairedBatch.entries.length}.`,
          ],
        };
      }

      writeJson(path.join(runDir, "03b-final-batch-after-repair.json"), repairedBatch);
      writeJson(path.join(runDir, "03c-repair-validation.json"), repairedValidation);

      if (repairedValidation.passed || repairedValidation.errors.length < validationBeforeRepair.errors.length) {
        logger.success(`Repair accepted: errors ${validationBeforeRepair.errors.length} → ${repairedValidation.errors.length}`);
        finalBatch = repairedBatch;
        validation = repairedValidation;
      } else {
        logger.warn(`Repair rejected: errors ${validationBeforeRepair.errors.length} → ${repairedValidation.errors.length}. Zachowuję oryginalny batch i nie importuję.`);
      }
    } else {
      logger.warn(`Walidacja znalazła ${validation.errors.length} błędów. Automatyczny repair finalnego batcha jest WYŁĄCZONY, żeby nie zepsuć przykładów.`);
      logger.info(`Opcjonalnie możesz włączyć dawny tryb przez WORDLY_ENABLE_FINAL_JSON_REPAIR=true, ale domyślnie bezpieczniej zatrzymać import.`);
    }
  }

  finalBatch = shuffleFinalBatchEntries(finalBatch, `${target.key}-${batchNumber}-${runId}`);
  writeJson(path.join(runDir, "03-final-batch.json"), finalBatch);

  const reportPath = path.join(paths.reports, `${slug}-${runId}.report.json`);
  const usagePath = path.join(paths.reports, `${slug}-${runId}.usage.json`);
  const outputIsValid = validation.passed;

  const finalJsonPath = outputIsValid
    ? path.join(paths.json, `${slug}.json`)
    : path.join(paths.reports, `${slug}-${runId}.invalid.json`);

  const csvPath = outputIsValid
    ? path.join(config.mode === "cefr" ? paths.cefr : paths.category, `${slug}.csv`)
    : path.join(paths.reports, `${slug}-${runId}.invalid.csv`);

  const previewPath = outputIsValid
    ? path.join(paths.previews, `${slug}-preview.md`)
    : path.join(paths.reports, `${slug}-${runId}.invalid-preview.md`);

  if (!outputIsValid) {
    logger.warn(`Batch nie przeszedł walidacji, więc NIE zapisuję go do datasets/json ani datasets/category/cefr. Pliki diagnostyczne trafią do datasets/reports.`);
  }

  writeJson(finalJsonPath, finalBatch);
  writeText(csvPath, batchToCsv(finalBatch));

  const usageTotals = usage.totals();
  const reportDraft = {
    run_id: runId,
    mode: config.mode,
    requested_size: requestedSize,
    usage: usage.all(),
    usage_totals: usageTotals,
    validation,
  };
  writeText(previewPath, buildPreviewMarkdown(finalBatch, reportDraft));
  writeJson(usagePath, { run_id: runId, usage: usage.all(), totals: usageTotals });

  let importResult: PipelineReport["import"] | undefined;
  if (cli.importLive || cli.dryImport || config.import?.enabled_by_default) {
    if (!validation.passed) {
      logger.warn("Pomijam import, bo batch nie przeszedł walidacji. Najpierw poprawiamy dane, potem zapis do bazy.");
    } else {
      logger.step(cli.importLive ? "Importuję do Supabase" : "Sprawdzam import do Supabase bez zapisu");
      importResult = await importBatchToSupabase(finalBatch, {
        dryRun: !cli.importLive,
        targetLanguageCode: config.target_language_code,
        sourceLanguageCode: config.source_language_code,
      });
      if (importResult.errors.length) logger.warn(`Import ma ${importResult.errors.length} problemów. Szczegóły są w raporcie.`);
      else {
        logger.success(`${importResult.dry_run ? "Dry import" : "Import"}: +${importResult.inserted_words} words, skipped=${importResult.skipped_existing}, attached_categories=${importResult.attached_categories}, senses=${importResult.inserted_senses}, examples=${importResult.inserted_examples}`);
        const skippedExistingLemmas = importResult.skipped_existing_lemmas ?? [];
        if (skippedExistingLemmas.length > 0) {
          const preview = skippedExistingLemmas.slice(0, 12).join(", ");
          logger.info(`Skipped existing: ${preview}${skippedExistingLemmas.length > 12 ? ", ..." : ""}`);
        }
        const attachedCategoryLemmas = importResult.attached_category_lemmas ?? [];
        if (attachedCategoryLemmas.length > 0) {
          const preview = attachedCategoryLemmas.slice(0, 12).join(", ");
          logger.info(`Attached category: ${preview}${attachedCategoryLemmas.length > 12 ? ", ..." : ""}`);
        }
      }
    }
  }

  if (validation.passed) {
    const imported = Boolean(importResult && !importResult.dry_run && importResult.errors.length === 0);
    recordGeneratedBatch({ paths, batch: finalBatch, mode: config.mode, imported });
    logger.success(`Local registry: zapisano ${finalBatch.entries.length} wygenerowanych lemma${importResult ? ` • realnie dodane do DB=${importResult.inserted_words}` : ""}`);
  }

  const finishedAt = now();
  const report: PipelineReport = {
    run_id: runId,
    mode: config.mode,
    target_language: config.target_language,
    source_language: config.source_language,
    level: target.level,
    category: target.category,
    batch: batchNumber,
    requested_size: requestedSize,
    generated_lemmas: plan.lemmas.length,
    final_entries: finalBatch.entries.length,
    final_senses: countSenses(finalBatch),
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: duration(runStarted),
    usage: usage.all(),
    usage_totals: usageTotals,
    files: {
      intermediate_dir: runDir,
      lemma_plan: path.join(runDir, "01-lemma-plan.json"),
      sense_candidates: path.join(runDir, "02b-sense-candidates-polished.json"),
      sense_candidates_raw: path.join(runDir, "02-sense-candidates.raw.json"),
      quality_fixes: path.join(runDir, "02b-quality-fixes.json"),
      final_intermediate: path.join(runDir, "03-final-batch.json"),
      final_json: finalJsonPath,
      csv: csvPath,
      preview: previewPath,
      usage: usagePath,
      log: logFile,
      report: reportPath,
    },
    validation,
    import: importResult,
  };

  writeJson(reportPath, report);

  if (validation.passed) logger.success(`Validation: OK • entries=${report.final_entries}, senses=${report.final_senses}`);
  else logger.fail(`Validation failed • errors=${validation.errors.length}`);

  logger.success(`Files saved: JSON, CSV, preview, report`);
  logger.info(`JSON: ${finalJsonPath}`);
  logger.detail(`CSV: ${csvPath}`);
  logger.detail(`Preview: ${previewPath}`);
  logger.info(`Report: ${reportPath}`);
  logger.info(`Total: ${(report.duration_ms / 1000).toFixed(1)}s • tokens=${usageTotals.total_tokens}${usageTotals.estimated_cost_usd === undefined ? "" : ` • ~$${usageTotals.estimated_cost_usd.toFixed(5)}`}`);

  logger.save();

  if (!validation.passed) {
    throw new Error(`Final batch validation failed: ${validation.errors.join(" | ")}`);
  }

  return report;
}
