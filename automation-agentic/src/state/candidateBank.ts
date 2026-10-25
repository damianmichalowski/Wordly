import fs from "fs";
import path from "path";
import { AgenticPaths } from "../io/paths";
import { CefrLevel, LemmaPlan, LemmaPlanItem, PipelineConfig } from "../types";

export type CandidateBankEntry = LemmaPlanItem & {
  added_at: string;
  source: "planner_refill" | "backfill_refill" | "manual";
};

export type CandidateBank = {
  version: 1;
  mode: "cefr" | "category";
  key: string;
  target_language: string;
  source_language: string;
  updated_at: string;
  candidates: CandidateBankEntry[];
};

export type CandidateBankTarget = {
  level?: CefrLevel;
  category?: string;
  key: string;
};

function normalizeLemmaKey(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shuffleInPlace<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function bankKey(config: PipelineConfig, target: CandidateBankTarget) {
  const language = config.target_language_code.toLowerCase();
  if (config.mode === "cefr") return `cefr-${language}-${String(target.level ?? target.key).toLowerCase()}`;
  return `category-${language}-${String(target.category ?? target.key).toLowerCase()}`;
}

export function candidateBankPath(paths: AgenticPaths, config: PipelineConfig, target: CandidateBankTarget) {
  return path.join(paths.candidates, `${bankKey(config, target)}.json`);
}

function emptyBank(config: PipelineConfig, target: CandidateBankTarget): CandidateBank {
  return {
    version: 1,
    mode: config.mode,
    key: bankKey(config, target),
    target_language: config.target_language,
    source_language: config.source_language,
    updated_at: new Date().toISOString(),
    candidates: [],
  };
}

export function loadCandidateBank(paths: AgenticPaths, config: PipelineConfig, target: CandidateBankTarget): CandidateBank {
  const file = candidateBankPath(paths, config, target);
  if (!fs.existsSync(file)) return emptyBank(config, target);

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as CandidateBank;
    if (!Array.isArray(parsed.candidates)) return emptyBank(config, target);
    return {
      ...emptyBank(config, target),
      ...parsed,
      candidates: parsed.candidates
        .map((item) => ({ ...item, lemma: normalizeLemmaKey(item.lemma), ipa: String(item.ipa ?? "").trim() }))
        .filter((item) => item.lemma && item.ipa && item.level),
    };
  } catch {
    return emptyBank(config, target);
  }
}

export function saveCandidateBank(paths: AgenticPaths, config: PipelineConfig, target: CandidateBankTarget, bank: CandidateBank) {
  const file = candidateBankPath(paths, config, target);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const unique = new Map<string, CandidateBankEntry>();

  for (const item of bank.candidates) {
    const lemma = normalizeLemmaKey(item.lemma);
    if (!lemma || !item.ipa || !item.level) continue;
    if (!unique.has(lemma)) unique.set(lemma, { ...item, lemma });
  }

  const normalized: CandidateBank = {
    ...bank,
    updated_at: new Date().toISOString(),
    candidates: Array.from(unique.values()).sort((a, b) => a.lemma.localeCompare(b.lemma)),
  };

  fs.writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
}

export function addCandidateBankItems(params: {
  paths: AgenticPaths;
  config: PipelineConfig;
  target: CandidateBankTarget;
  items: LemmaPlanItem[];
  excluded: Iterable<string>;
  source: CandidateBankEntry["source"];
}) {
  const bank = loadCandidateBank(params.paths, params.config, params.target);
  const excluded = new Set(Array.from(params.excluded).map(normalizeLemmaKey));
  const existing = new Set(bank.candidates.map((item) => normalizeLemmaKey(item.lemma)));
  let added = 0;

  for (const raw of params.items) {
    const lemma = normalizeLemmaKey(raw.lemma);
    const ipa = String(raw.ipa ?? "").trim();
    const level = raw.level;
    if (!lemma || !ipa || !level) continue;
    if (excluded.has(lemma) || existing.has(lemma)) continue;
    bank.candidates.push({ lemma, ipa, level, source: params.source, added_at: new Date().toISOString() });
    existing.add(lemma);
    added += 1;
  }

  if (added > 0) saveCandidateBank(params.paths, params.config, params.target, bank);
  return { added, total: bank.candidates.length, path: candidateBankPath(params.paths, params.config, params.target) };
}

export function selectCandidatePlanFromBank(params: {
  paths: AgenticPaths;
  config: PipelineConfig;
  target: CandidateBankTarget;
  batch: number;
  excluded: Iterable<string>;
  limit: number;
}): { plan: LemmaPlan; availableCount: number; bankSize: number; path: string } {
  const bank = loadCandidateBank(params.paths, params.config, params.target);
  const excluded = new Set(Array.from(params.excluded).map(normalizeLemmaKey));
  const seen = new Set<string>();
  const available = bank.candidates.filter((item) => {
    const lemma = normalizeLemmaKey(item.lemma);
    if (!lemma || excluded.has(lemma) || seen.has(lemma)) return false;
    seen.add(lemma);
    return true;
  });

  // Do not take candidates in stored order. Large lemma-only refills are often returned
  // alphabetically by the model, and saveCandidateBank keeps the JSON readable by sorting.
  // Shuffle selection so generated batches do not look like dictionary pages: active, activity, afraid...
  const shuffledAvailable = shuffleInPlace([...available]);

  const lemmas = shuffledAvailable.slice(0, params.limit).map((item) => ({
    lemma: normalizeLemmaKey(item.lemma),
    ipa: item.ipa,
    level: params.config.mode === "cefr" ? (params.target.level as CefrLevel) : item.level,
  }));

  return {
    plan: {
      target_language: params.config.target_language,
      source_language: params.config.source_language,
      ...(params.config.mode === "cefr" ? { level: params.target.level } : { category: params.target.category }),
      batch: params.batch,
      lemmas,
    },
    availableCount: available.length,
    bankSize: bank.candidates.length,
    path: candidateBankPath(params.paths, params.config, params.target),
  };
}
