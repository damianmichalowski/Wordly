import fs from "fs";
import path from "path";
import { CefrLevel, FinalBatch, Mode } from "../types";
import { AgenticPaths } from "../io/paths";

export type GeneratedLemmaRegistryEntry = {
  lemma: string;
  mode: Mode;
  level?: CefrLevel;
  category?: string;
  batch: number;
  imported: boolean;
  created_at: string;
  updated_at: string;
  source: "agentic_generated";
};

export type GeneratedLemmaRegistry = {
  version: 1;
  updated_at: string;
  languages: Record<string, Record<string, GeneratedLemmaRegistryEntry>>;
};

function registryPath(paths: AgenticPaths) {
  return path.join(paths.state, "generated-lemmas.json");
}

function normalizeLanguage(value: string) {
  return String(value ?? "").trim().toLowerCase() || "unknown";
}

function normalizeLemma(value: string) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function emptyRegistry(): GeneratedLemmaRegistry {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    languages: {},
  };
}

export function loadGeneratedLemmaRegistry(paths: AgenticPaths): GeneratedLemmaRegistry {
  const file = registryPath(paths);
  if (!fs.existsSync(file)) return emptyRegistry();

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) return emptyRegistry();
    if (!parsed.languages || typeof parsed.languages !== "object") parsed.languages = {};
    return parsed as GeneratedLemmaRegistry;
  } catch {
    return emptyRegistry();
  }
}

export function saveGeneratedLemmaRegistry(paths: AgenticPaths, registry: GeneratedLemmaRegistry) {
  fs.mkdirSync(paths.state, { recursive: true });
  registry.updated_at = new Date().toISOString();
  fs.writeFileSync(registryPath(paths), `${JSON.stringify(registry, null, 2)}\n`, "utf-8");
}

export function listGeneratedRegistryLemmas(params: {
  paths: AgenticPaths;
  targetLanguage: string;
  mode?: Mode;
  category?: string;
}): string[] {
  const registry = loadGeneratedLemmaRegistry(params.paths);
  const langKey = normalizeLanguage(params.targetLanguage);
  const languageBucket = registry.languages[langKey] ?? {};
  const categoryKey = params.category ? normalizeLemma(params.category) : undefined;

  return Object.values(languageBucket)
    .filter((entry) => !params.mode || entry.mode === params.mode)
    // CEFR remains global per language. Category registry is scoped per category,
    // because the same lemma can legitimately belong to multiple categories.
    .filter((entry) => params.mode !== "category" || !categoryKey || normalizeLemma(entry.category ?? "") === categoryKey)
    .map((entry) => normalizeLemma(entry.lemma))
    .filter(Boolean);
}

export function recordGeneratedBatch(params: {
  paths: AgenticPaths;
  batch: FinalBatch;
  mode: Mode;
  imported: boolean;
}) {
  const registry = loadGeneratedLemmaRegistry(params.paths);
  const langKey = normalizeLanguage(params.batch.target_language);
  const now = new Date().toISOString();

  if (!registry.languages[langKey]) registry.languages[langKey] = {};
  const bucket = registry.languages[langKey];

  for (const entry of params.batch.entries ?? []) {
    const lemma = normalizeLemma(entry.lemma);
    if (!lemma) continue;

    const registryKey = params.mode === "category" && params.batch.category
      ? `category:${normalizeLemma(params.batch.category)}:${lemma}`
      : lemma;

    const previous = bucket[registryKey];
    bucket[registryKey] = {
      lemma,
      mode: params.mode,
      level: params.batch.level ?? entry.level,
      category: params.batch.category,
      batch: params.batch.batch,
      imported: params.imported || previous?.imported || false,
      created_at: previous?.created_at ?? now,
      updated_at: now,
      source: "agentic_generated",
    };
  }

  saveGeneratedLemmaRegistry(params.paths, registry);
}

export function registryFilePath(paths: AgenticPaths) {
  return registryPath(paths);
}
