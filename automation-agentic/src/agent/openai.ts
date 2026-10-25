import fs from "fs";
import path from "path";
import { PriceConfig, UsageRecord } from "../types";
import { estimateCost } from "./usage";

export type JsonCallParams = {
  step: string;
  model: string;
  system: string;
  user: string;
  maxOutputTokens: number;
  prices?: PriceConfig;
  schemaName: string;
  schema: unknown;
  rawResponsePath?: string;
};

function ensureParent(filePath?: string) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeDebug(filePath: string | undefined, value: string) {
  if (!filePath) return;
  ensureParent(filePath);
  fs.writeFileSync(filePath, value, "utf-8");
}


function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function retryDelayMs(attempt: number) {
  const base = 1200 * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * 400);
  return Math.min(12000, base + jitter);
}

async function postResponsesWithRetry(apiKey: string, requestBody: unknown): Promise<{ response: Response; body: string }> {
  const maxAttempts = Number(process.env.WORDLY_OPENAI_RETRY_ATTEMPTS ?? 4);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const body = await response.text();
      if (response.ok || !isRetryableStatus(response.status) || attempt === maxAttempts) {
        return { response, body };
      }

      const delay = retryDelayMs(attempt);
      console.warn(`⚠️  OpenAI request failed with HTTP ${response.status}. Retry ${attempt}/${maxAttempts - 1} in ${Math.round(delay / 1000)}s.`);
      await sleep(delay);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      const delay = retryDelayMs(attempt);
      console.warn(`⚠️  OpenAI network error: ${error instanceof Error ? error.message : String(error)}. Retry ${attempt}/${maxAttempts - 1} in ${Math.round(delay / 1000)}s.`);
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "OpenAI request failed"));
}

function extractTextFromResponsesBody(parsed: any): string {
  if (typeof parsed.output_text === "string" && parsed.output_text.trim()) {
    return parsed.output_text;
  }

  const chunks: string[] = [];
  for (const item of parsed.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") chunks.push(content.text);
      if (typeof content.output_text === "string") chunks.push(content.output_text);
    }
  }

  return chunks.join("\n").trim();
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    if (fenced) return JSON.parse(fenced);

    const firstObject = trimmed.indexOf("{");
    const lastObject = trimmed.lastIndexOf("}");
    if (firstObject !== -1 && lastObject !== -1 && lastObject > firstObject) {
      return JSON.parse(trimmed.slice(firstObject, lastObject + 1));
    }

    const firstArray = trimmed.indexOf("[");
    const lastArray = trimmed.lastIndexOf("]");
    if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
      return JSON.parse(trimmed.slice(firstArray, lastArray + 1));
    }

    throw new Error("Model did not return valid JSON.");
  }
}

function usageFromResponses(parsed: any, started: number, finished: number, params: JsonCallParams): UsageRecord {
  const inputTokens = parsed.usage?.input_tokens ?? parsed.usage?.prompt_tokens ?? 0;
  const outputTokens = parsed.usage?.output_tokens ?? parsed.usage?.completion_tokens ?? 0;
  const totalTokens = parsed.usage?.total_tokens ?? inputTokens + outputTokens;

  return {
    step: params.step,
    model: params.model,
    started_at: new Date(started).toISOString(),
    finished_at: new Date(finished).toISOString(),
    duration_ms: finished - started,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    estimated_cost_usd: estimateCost(params.model, inputTokens, outputTokens, params.prices),
  };
}

export async function callJsonModel<T>(params: JsonCallParams): Promise<{ data: T; usage: UsageRecord; raw: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY.");

  const started = Date.now();

  const requestBody = {
    model: params.model,
    input: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    reasoning: { effort: "minimal" },
    max_output_tokens: params.maxOutputTokens,
    text: {
      format: {
        type: "json_schema",
        name: params.schemaName,
        strict: true,
        schema: params.schema,
      },
    },
  };

  const { response, body } = await postResponsesWithRetry(apiKey, requestBody);
  const finished = Date.now();
  writeDebug(params.rawResponsePath, body);

  if (!response.ok) {
    throw new Error(`OpenAI request failed ${response.status}. Raw response saved: ${params.rawResponsePath ?? "not configured"}. ${body.slice(0, 1000)}`);
  }

  const parsed = JSON.parse(body);
  const usage = usageFromResponses(parsed, started, finished, params);

  if (parsed.status === "incomplete") {
    const reason = parsed.incomplete_details?.reason ?? "unknown";
    throw new Error(`OpenAI response incomplete (${reason}). Increase max_output_tokens or lower batch size. Raw response saved: ${params.rawResponsePath ?? "not configured"}`);
  }

  const raw = extractTextFromResponsesBody(parsed);
  if (!raw) {
    throw new Error(`OpenAI response had no visible JSON output. Raw response saved: ${params.rawResponsePath ?? "not configured"}`);
  }

  return { data: extractJson(raw) as T, usage, raw };
}
