import { CategoryConfig, CategoryDefinition, CategoryLevelDistribution, CefrLevel } from "../types";

export type ResolvedCategorySettings = {
  code: string;
  target_words: number;
  level_distribution: CategoryLevelDistribution;
  mix?: {
    core?: number;
    adjacent?: number;
    specialized?: number;
  };
  profile?: string;
  prefer: string[];
  avoid: string[];
  level_policy: string[];
  notes: string[];
};

const CEFR_ORDER: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

function normalizeCategoryCode(value: string) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeDistribution(value: unknown): CategoryLevelDistribution {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  const result: CategoryLevelDistribution = {};

  for (const level of CEFR_ORDER) {
    const raw = input[level];
    const num = Number(raw);
    if (Number.isFinite(num) && num >= 0) result[level] = num;
  }

  return result;
}

function mergeDistribution(defaultDistribution: CategoryLevelDistribution | undefined, categoryDistribution: CategoryLevelDistribution | undefined) {
  return {
    ...(defaultDistribution ?? {}),
    ...(categoryDistribution ?? {}),
  } as CategoryLevelDistribution;
}

function normalizeCategoryDefinition(value: CategoryConfig["categories"][string] | undefined): Partial<CategoryDefinition> {
  if (typeof value === "number") return { target_words: value };
  if (value && typeof value === "object") return value;
  return {};
}

export function getCategoryCodes(config: CategoryConfig): string[] {
  return Object.keys(config.categories ?? {}).sort();
}

export function getCategoryTargetWords(config: CategoryConfig, category: string): number {
  const key = normalizeCategoryCode(category);
  const definition = normalizeCategoryDefinition(config.categories?.[key]);
  const target = Number(definition.target_words ?? config.default_target);

  if (!Number.isFinite(target) || target <= 0) {
    throw new Error(`Invalid target_words for category "${key}" in config/category.json`);
  }

  return Math.floor(target);
}

export function getCategorySettings(config: CategoryConfig, category: string): ResolvedCategorySettings {
  const key = normalizeCategoryCode(category || config.default_category);
  const definition = normalizeCategoryDefinition(config.categories?.[key]);
  const target_words = getCategoryTargetWords(config, key);
  const defaultDistribution = normalizeDistribution(config.default_level_distribution);
  const categoryDistribution = normalizeDistribution(definition.level_distribution);

  return {
    code: key,
    target_words,
    level_distribution: mergeDistribution(defaultDistribution, categoryDistribution),
    mix: definition.mix,
    profile: definition.profile,
    prefer: normalizeStringArray(definition.prefer),
    avoid: normalizeStringArray(definition.avoid),
    level_policy: normalizeStringArray(definition.level_policy),
    notes: normalizeStringArray(definition.notes),
  };
}

function renderDistribution(distribution: CategoryLevelDistribution) {
  const entries = CEFR_ORDER
    .map((level) => [level, distribution[level]] as const)
    .filter(([, value]) => typeof value === "number");

  if (entries.length === 0) return "No strict category CEFR distribution configured; use realistic CEFR levels by learner usefulness.";

  const total = entries.reduce((sum, [, value]) => sum + Number(value ?? 0), 0);
  const rendered = entries.map(([level, value]) => `${level}: ${value}%`).join(", ");
  const warning = total > 0 && Math.abs(total - 100) > 2 ? ` Configured total is ${total}%, so treat these as relative weights.` : "";
  return `${rendered}.${warning}`;
}

function renderMix(mix: ResolvedCategorySettings["mix"]) {
  if (!mix) return "Use a practical domain mix: core category vocabulary first, then adjacent communication, then specialized terms when genuinely useful.";
  const parts = [
    typeof mix.core === "number" ? `${mix.core}% core category vocabulary` : undefined,
    typeof mix.adjacent === "number" ? `${mix.adjacent}% adjacent practical communication` : undefined,
    typeof mix.specialized === "number" ? `${mix.specialized}% specialized/domain vocabulary` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? `Vocabulary mix target: about ${parts.join(", ")}.` : "Use a practical domain mix.";
}

export function buildCategoryConfigPrompt(config: CategoryConfig, category: string): string {
  const settings = getCategorySettings(config, category);
  const lines = [
    `CATEGORY CONFIG: ${settings.code}`,
    `Target total words for this category: ${settings.target_words}.`,
    settings.profile ? `Profile: ${settings.profile}` : `Profile: choose words that help the learner operate in ${settings.code} in real life.`,
    renderMix(settings.mix),
    `CEFR/level distribution target for this category: ${renderDistribution(settings.level_distribution)}`,
    `Level rule: follow the configured category distribution. Do not make the category too easy by overproducing A1-A2, and do not add C1-C2 unless the word is genuinely useful in the category.`,
  ];

  if (settings.prefer.length > 0) lines.push(`Prefer: ${settings.prefer.join(", ")}.`);
  if (settings.avoid.length > 0) lines.push(`Avoid: ${settings.avoid.join(", ")}.`);
  if (settings.level_policy.length > 0) lines.push(`Category level policy: ${settings.level_policy.join(" ")}`);
  if (settings.notes.length > 0) lines.push(`Additional notes: ${settings.notes.join(" ")}`);

  lines.push(
    `Accuracy rule: specialized vocabulary is good only when it is a real, high-value word for the category. Never add niche jargon or a weak category-adjacent lemma just to satisfy percentages.`,
    `Sense rule: do not add extra senses only to increase sense count. If one category-relevant sense is the only strong sense, keep one sense.`
  );

  return lines.join("\n");
}
