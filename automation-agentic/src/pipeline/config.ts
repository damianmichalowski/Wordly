import path from "path";
import { CategoryConfig, CefrConfig, PipelineConfig } from "../types";
import { getPaths } from "../io/paths";
import { readJson } from "../io/json";

export function loadConfig(mode: "cefr"): CefrConfig;
export function loadConfig(mode: "category"): CategoryConfig;
export function loadConfig(mode: "cefr" | "category"): PipelineConfig {
  const paths = getPaths();
  const file = path.join(paths.config, `${mode}.json`);
  const config = readJson<PipelineConfig>(file);

  if (config.mode !== mode) {
    throw new Error(`Config ${file} has mode=${config.mode}, expected ${mode}`);
  }

  config.models.lemma_planner = process.env.WORDLY_AGENTIC_MODEL_PLANNER || config.models.lemma_planner;
  config.models.sense_explorer = process.env.WORDLY_AGENTIC_MODEL_SENSES || config.models.sense_explorer;
  config.models.json_repair = process.env.WORDLY_AGENTIC_MODEL_REPAIR || config.models.json_repair;

  return config;
}
