import fs from "fs";
import path from "path";
import { Mode } from "../types";

export type AgenticPaths = {
  root: string;
  config: string;
  datasets: string;
  json: string;
  cefr: string;
  category: string;
  cache: string;
  intermediate: string;
  previews: string;
  reports: string;
  state: string;
  candidates: string;
};

export function getPaths(): AgenticPaths {
  const root = path.resolve(process.cwd(), "automation-agentic");
  return {
    root,
    config: path.join(root, "config"),
    datasets: path.join(root, "datasets"),
    json: path.join(root, "datasets", "json"),
    cefr: path.join(root, "datasets", "cefr"),
    category: path.join(root, "datasets", "category"),
    cache: path.join(root, "datasets", "cache"),
    intermediate: path.join(root, "datasets", "intermediate"),
    previews: path.join(root, "datasets", "previews"),
    reports: path.join(root, "datasets", "reports"),
    state: path.join(root, "datasets", "state"),
    candidates: path.join(root, "datasets", "candidates"),
  };
}

export function ensureDirs(paths = getPaths()) {
  for (const dir of Object.values(paths)) {
    if (typeof dir === "string" && !path.extname(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  fs.mkdirSync(paths.config, { recursive: true });
  fs.mkdirSync(paths.datasets, { recursive: true });
  fs.mkdirSync(paths.json, { recursive: true });
  fs.mkdirSync(paths.cefr, { recursive: true });
  fs.mkdirSync(paths.category, { recursive: true });
  fs.mkdirSync(paths.cache, { recursive: true });
  fs.mkdirSync(paths.intermediate, { recursive: true });
  fs.mkdirSync(paths.previews, { recursive: true });
  fs.mkdirSync(paths.reports, { recursive: true });
  fs.mkdirSync(paths.state, { recursive: true });
  fs.mkdirSync(paths.candidates, { recursive: true });
}

export function slugForBatch(params: { mode: Mode; level?: string; category?: string; batch: number }) {
  const prefix = params.mode === "cefr" ? (params.level ?? "unknown").toLowerCase() : (params.category ?? "category").toLowerCase();
  return `${prefix}_${String(params.batch).padStart(3, "0")}`;
}

export function safeRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
