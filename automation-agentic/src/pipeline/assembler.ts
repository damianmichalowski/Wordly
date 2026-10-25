import { FinalBatch, FinalEntry, FinalSense, LemmaPlan, PartOfSpeech, PipelineConfig, POS_VALUES, SenseCandidateEntry, SenseExplorerResult } from "../types";

function clean(value: string) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function cleanLemma(value: string) {
  return clean(value).toLowerCase();
}

function normalizePos(value: string): PartOfSpeech {
  const pos = clean(value).toLowerCase() as PartOfSpeech;
  if (POS_VALUES.includes(pos)) return pos;
  return "other";
}

function normalizeScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 3;
  return Math.max(1, Math.min(5, Math.round(score)));
}

function ensureSentencePunctuation(value: string) {
  const text = clean(value);
  if (!text) return text;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function splitOnTopLevelSlashes(value: string) {
  const text = clean(value);
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);

    if (char === "/" && depth === 0) {
      parts.push(clean(current));
      current = "";
      continue;
    }

    current += char;
  }

  parts.push(clean(current));
  return parts.filter(Boolean);
}

function hasTopLevelSlash(value: string) {
  return splitOnTopLevelSlashes(value).length > 1;
}

function splitOnTopLevelCommas(value: string) {
  const text = clean(value);
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);

    if (char === "," && depth === 0) {
      parts.push(clean(current));
      current = "";
      continue;
    }

    current += char;
  }

  parts.push(clean(current));
  return parts.filter(Boolean);
}

function hasTopLevelComma(value: string) {
  return splitOnTopLevelCommas(value).length > 1;
}


function hasBalancedParentheses(value: string) {
  let depth = 0;
  for (const char of String(value ?? "")) {
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function isAllowedSlashTranslation(value: string) {
  const text = clean(value).toLowerCase();
  if (!hasTopLevelSlash(text)) return true;

  const parts = splitOnTopLevelSlashes(text);
  if (parts.length !== 2) return false;

  const pair = parts.join("/");
  const allowedPairs = new Set([
    "sąsiad/sąsiadka",
    "sąsiadka/sąsiad",
    "kolega/koleżanka",
    "koleżanka/kolega",
    "kolega z pracy/koleżanka z pracy",
    "koleżanka z pracy/kolega z pracy",
    "przyjaciel/przyjaciółka",
    "przyjaciółka/przyjaciel",
    "klient/klientka",
    "klientka/klient",
    "pracownik/pracownica",
    "pracownica/pracownik",
    "nauczyciel/nauczycielka",
    "nauczycielka/nauczyciel",
    "uczeń/uczennica",
    "uczennica/uczeń",
  ]);

  return allowedPairs.has(pair);
}

function expandDelimitedCandidate(candidate: SenseCandidateEntry["candidates"][number]) {
  const translation = clean(candidate.tr);

  // Slash is allowed only for true gender variants, e.g. sąsiad/sąsiadka.
  // A slash inside balanced parentheses, e.g. uważać (kogoś/coś za), is ignored by splitOnTopLevelSlashes.
  if (hasTopLevelSlash(translation) && !isAllowedSlashTranslation(translation)) {
    const parts = splitOnTopLevelSlashes(translation).slice(0, 4);
    if (parts.length > 1) {
      return parts.map((part, index) => ({
        ...candidate,
        tr: part,
        score: Math.max(1, normalizeScore(candidate.score) - index),
      }));
    }
  }

  // Comma must never be used as a list of translation alternatives.
  // Commas inside parentheses are allowed as clarification and are ignored here.
  if (hasTopLevelComma(translation)) {
    const parts = splitOnTopLevelCommas(translation).slice(0, 4);
    if (parts.length > 1) {
      return parts.map((part, index) => ({
        ...candidate,
        tr: part,
        score: Math.max(1, normalizeScore(candidate.score) - index),
      }));
    }
  }

  return [candidate];
}


function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lemmaForms(lemma: string) {
  const base = cleanLemma(lemma);
  const forms = new Set<string>([base]);

  // Common English inflections. This is intentionally conservative:
  // it should catch true inflections, but not derived nouns like arrangement/responsibility/decision.
  if (base.includes(" ")) {
    const parts = base.split(/\s+/);
    const last = parts[parts.length - 1];
    const prefix = parts.slice(0, -1).join(" ");
    const inflectLast = (form: string) => forms.add(`${prefix} ${form}`.trim());
    for (const form of simpleInflections(last)) inflectLast(form);
  } else {
    for (const form of simpleInflections(base)) forms.add(form);
  }

  return Array.from(forms).filter(Boolean);
}

function simpleInflections(word: string) {
  const forms = new Set<string>([word]);
  forms.add(`${word}s`);
  forms.add(`${word}es`);
  forms.add(`${word}ed`);
  forms.add(`${word}ing`);

  if (word.endsWith("e") && word.length > 2) {
    forms.add(`${word}d`);
    forms.add(`${word.slice(0, -1)}ing`);
  }

  if (word.endsWith("y") && word.length > 2) {
    forms.add(`${word.slice(0, -1)}ies`);
    forms.add(`${word.slice(0, -1)}ied`);
  }

  return Array.from(forms);
}

function examplesUseLemma(lemma: string, examples: string[]) {
  const forms = lemmaForms(lemma);
  return examples.some((example) => {
    const text = clean(example).toLowerCase();
    return forms.some((form) => new RegExp(`(^|[^a-z])${escapeRegExp(form)}([^a-z]|$)`, "i").test(text));
  });
}

function examplePairKey(candidate: SenseCandidateEntry["candidates"][number]) {
  const examples = Array.isArray(candidate.ex) ? candidate.ex.slice(0, 2).map((item) => clean(item).toLowerCase()) : [];
  return `${normalizePos(candidate.pos)}::${examples.join("||")}`;
}

function buildSense(candidate: SenseCandidateEntry["candidates"][number], order: number): FinalSense {
  const examples = Array.isArray(candidate.ex) ? candidate.ex.slice(0, 2).map((item) => ensureSentencePunctuation(item)) : [];
  while (examples.length < 2) examples.push(`Example missing for ${candidate.tr}.`);

  return {
    sense_order: order,
    part_of_speech: normalizePos(candidate.pos),
    translation: {
      text: clean(candidate.tr),
      examples: examples.map((text, index) => ({ text, example_order: index + 1 })),
    },
  };
}

export function assembleFinalBatch(params: {
  config: PipelineConfig;
  plan: LemmaPlan;
  explored: SenseExplorerResult;
  maxFinalSenses: number;
}): FinalBatch {
  const { config, plan, explored, maxFinalSenses } = params;
  const byLemma = new Map<string, SenseCandidateEntry>();

  for (const entry of explored.entries ?? []) {
    byLemma.set(cleanLemma(entry.lemma), entry);
  }

  const entries: FinalEntry[] = [];

  for (const planned of plan.lemmas) {
    const lemma = cleanLemma(planned.lemma);
    const exploredEntry = byLemma.get(lemma);
    if (!exploredEntry) continue;

    const seenSenseKeys = new Set<string>();
    const expandedCandidates = (exploredEntry.candidates ?? []).flatMap((candidate) => expandDelimitedCandidate(candidate));

    const candidates = expandedCandidates
      .map((candidate, index) => {
        const examples = Array.isArray(candidate.ex) ? candidate.ex.map(clean) : [];
        const usesLemma = examplesUseLemma(lemma, examples);
        const score = normalizeScore(candidate.score);

        return {
          ...candidate,
          score: usesLemma ? score : Math.min(score, 2),
          _index: index,
          _usesLemma: usesLemma,
        };
      })
      .filter((candidate) => clean(candidate.tr).length > 0 && hasBalancedParentheses(candidate.tr) && Array.isArray(candidate.ex) && candidate.ex.filter((ex) => clean(ex).length > 0).length >= 2)
      .filter((candidate) => {
        const key = `${normalizePos(candidate.pos)}::${clean(candidate.tr).toLowerCase()}`;
        if (seenSenseKeys.has(key)) return false;
        seenSenseKeys.add(key);
        return true;
      })
      .sort((a, b) => b.score - a.score || a._index - b._index)
      .filter((candidate, index, sorted) => {
        const key = examplePairKey(candidate);
        if (!key.includes("||")) return true;
        return sorted.findIndex((item) => examplePairKey(item) === key) === index;
      });

    const strong = candidates.filter((candidate) => candidate.score >= 3);
    const selected = (strong.length > 0 ? strong : candidates).slice(0, maxFinalSenses);
    if (selected.length === 0) continue;

    entries.push({
      lemma,
      ipa: clean(planned.ipa || exploredEntry.ipa),
      level: planned.level,
      senses: selected.map((candidate, index) => buildSense(candidate, index + 1)),
    });
  }

  return {
    target_language: config.target_language,
    source_language: config.source_language,
    ...(config.mode === "cefr" ? { level: plan.level } : { category: plan.category }),
    batch: plan.batch,
    entries,
  };
}
