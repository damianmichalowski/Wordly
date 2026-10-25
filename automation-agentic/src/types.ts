export type Mode = "cefr" | "category";
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type PartOfSpeech = "noun" | "verb" | "adjective" | "adverb" | "preposition" | "phrase" | "other";

export const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
export const POS_VALUES: PartOfSpeech[] = ["noun", "verb", "adjective", "adverb", "preposition", "phrase", "other"];

export type ModelConfig = {
  lemma_planner: string;
  sense_explorer: string;
  json_repair: string;
};

export type PriceConfig = Record<string, { input: number; output: number }>;

export type CategoryLevelDistribution = Partial<Record<CefrLevel, number>>;

export type CategoryDefinition = {
  target_words: number;
  level_distribution?: CategoryLevelDistribution;
  mix?: {
    core?: number;
    adjacent?: number;
    specialized?: number;
  };
  profile?: string;
  prefer?: string[];
  avoid?: string[];
  level_policy?: string[];
  notes?: string[];
};

export type BaseConfig = {
  mode: Mode;
  target_language: string;
  target_language_code: string;
  source_language: string;
  source_language_code: string;
  batch_size: number;
  max_batches_per_run: number;
  models: ModelConfig;
  limits: {
    excluded_lemmas_limit: number;
    max_candidates_per_lemma: number;
    max_final_senses_per_lemma: number;
    examples_per_sense: number;
  };
  prices_per_1m_tokens?: PriceConfig;
  import?: {
    enabled_by_default?: boolean;
    cefr_existing_policy?: "skip_existing";
    category_existing_policy?: "attach_category_only" | "skip_existing";
  };
};

export type CefrConfig = BaseConfig & {
  mode: "cefr";
  default_level: CefrLevel;
  levels: CefrLevel[];
  targets: Record<CefrLevel, number>;
};

export type CategoryConfig = BaseConfig & {
  mode: "category";
  default_category: string;
  default_target: number;
  default_level_distribution?: CategoryLevelDistribution;
  categories: Record<string, number | CategoryDefinition>;
};

export type PipelineConfig = CefrConfig | CategoryConfig;

export type CliOptions = {
  mode: Mode;
  level?: CefrLevel;
  category?: string;
  size?: number;
  batch?: number;
  maxBatches?: number;
  importLive: boolean;
  dryImport: boolean;
  skipDb: boolean;
  previewOnly: boolean;
  verbose: boolean;
};

export type LemmaPlanItem = {
  lemma: string;
  ipa: string;
  level: CefrLevel;
};

export type LemmaPlan = {
  target_language: string;
  source_language: string;
  level?: CefrLevel;
  category?: string;
  batch: number;
  lemmas: LemmaPlanItem[];
};

export type SenseCandidateCompact = {
  pos: PartOfSpeech;
  tr: string;
  score: number;
  ex: string[];
};

export type SenseCandidateEntry = {
  lemma: string;
  ipa: string;
  level: CefrLevel;
  candidates: SenseCandidateCompact[];
};

export type SenseExplorerResult = {
  target_language: string;
  source_language: string;
  level?: CefrLevel;
  category?: string;
  batch: number;
  entries: SenseCandidateEntry[];
};

export type Example = {
  text: string;
  example_order: number;
};

export type FinalSense = {
  sense_order: number;
  part_of_speech: PartOfSpeech;
  translation: {
    text: string;
    examples: Example[];
  };
};

export type FinalEntry = {
  lemma: string;
  ipa: string;
  level: CefrLevel;
  senses: FinalSense[];
};

export type FinalBatch = {
  target_language: string;
  source_language: string;
  level?: CefrLevel;
  category?: string;
  batch: number;
  entries: FinalEntry[];
};

export type UsageRecord = {
  step: string;
  model: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd?: number;
};

export type PipelineReport = {
  run_id: string;
  mode: Mode;
  target_language: string;
  source_language: string;
  level?: CefrLevel;
  category?: string;
  batch: number;
  requested_size: number;
  generated_lemmas: number;
  final_entries: number;
  final_senses: number;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  usage: UsageRecord[];
  usage_totals: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost_usd?: number;
  };
  files: Record<string, string>;
  validation: {
    passed: boolean;
    errors: string[];
    warnings: string[];
  };
  import?: {
    attempted: boolean;
    dry_run: boolean;
    inserted_words: number;
    skipped_existing: number;
    inserted_senses: number;
    inserted_examples: number;
    attached_categories: number;
    inserted_lemmas?: string[];
    skipped_existing_lemmas?: string[];
    attached_category_lemmas?: string[];
    errors: string[];
  };
};
