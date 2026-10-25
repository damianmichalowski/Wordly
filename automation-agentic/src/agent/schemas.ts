import { Mode } from "../types";

const cefrEnum = ["A1", "A2", "B1", "B2", "C1", "C2"];
const posEnum = ["noun", "verb", "adjective", "adverb", "preposition", "phrase", "other"];

const lemmaItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    lemma: { type: "string" },
    ipa: { type: "string" },
    level: { type: "string", enum: cefrEnum },
  },
  required: ["lemma", "ipa", "level"],
} as const;

const candidateSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pos: { type: "string", enum: posEnum },
    tr: { type: "string" },
    score: { type: "integer", enum: [1, 2, 3, 4, 5] },
    ex: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["pos", "tr", "score", "ex"],
} as const;

const senseCandidateEntrySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    lemma: { type: "string" },
    ipa: { type: "string" },
    level: { type: "string", enum: cefrEnum },
    candidates: {
      type: "array",
      items: candidateSchema,
    },
  },
  required: ["lemma", "ipa", "level", "candidates"],
} as const;

const exampleSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    text: { type: "string" },
    example_order: { type: "integer", enum: [1, 2] },
  },
  required: ["text", "example_order"],
} as const;

const finalSenseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    sense_order: { type: "integer" },
    part_of_speech: { type: "string", enum: posEnum },
    translation: {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string" },
        examples: {
          type: "array",
      items: exampleSchema,
        },
      },
      required: ["text", "examples"],
    },
  },
  required: ["sense_order", "part_of_speech", "translation"],
} as const;

const finalEntrySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    lemma: { type: "string" },
    ipa: { type: "string" },
    level: { type: "string", enum: cefrEnum },
    senses: {
      type: "array",
      items: finalSenseSchema,
    },
  },
  required: ["lemma", "ipa", "level", "senses"],
} as const;

function rootModeFields(mode: Mode, valueName: "plan" | "explore" | "final") {
  const common = {
    target_language: { type: "string" },
    source_language: { type: "string" },
    batch: { type: "integer" },
  } as const;

  if (mode === "cefr") {
    return {
      properties: { ...common, level: { type: "string", enum: cefrEnum } },
      required: ["target_language", "source_language", "level", "batch", valueName === "plan" ? "lemmas" : "entries"],
    } as const;
  }

  return {
    properties: { ...common, category: { type: "string" } },
    required: ["target_language", "source_language", "category", "batch", valueName === "plan" ? "lemmas" : "entries"],
  } as const;
}

export function lemmaPlanSchema(mode: Mode) {
  const modeFields = rootModeFields(mode, "plan");
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      ...modeFields.properties,
      lemmas: {
        type: "array",
      items: lemmaItemSchema,
      },
    },
    required: modeFields.required,
  } as const;
}

export function senseExplorerSchema(mode: Mode) {
  const modeFields = rootModeFields(mode, "explore");
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      ...modeFields.properties,
      entries: {
        type: "array",
      items: senseCandidateEntrySchema,
      },
    },
    required: modeFields.required,
  } as const;
}

export function finalBatchSchema(mode: Mode) {
  const modeFields = rootModeFields(mode, "final");
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      ...modeFields.properties,
      entries: {
        type: "array",
      items: finalEntrySchema,
      },
    },
    required: modeFields.required,
  } as const;
}
