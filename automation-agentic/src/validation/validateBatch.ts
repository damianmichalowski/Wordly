import { CEFR_LEVELS, FinalBatch, POS_VALUES } from "../types";

export type ValidationResult = {
  passed: boolean;
  errors: string[];
  warnings: string[];
};

function isBlank(value: unknown) {
  return typeof value !== "string" || value.trim().length === 0;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function lemmaForms(lemma: string) {
  const base = lemma.trim().toLowerCase().replace(/\s+/g, " ");
  const forms = new Set<string>([base]);

  if (base.includes(" ")) {
    const parts = base.split(/\s+/);
    const last = parts[parts.length - 1];
    const prefix = parts.slice(0, -1).join(" ");
    for (const form of simpleInflections(last)) forms.add(`${prefix} ${form}`.trim());
  } else {
    for (const form of simpleInflections(base)) forms.add(form);
  }

  return Array.from(forms).filter(Boolean);
}

function examplesUseLemma(lemma: string, examples: string[]) {
  const forms = lemmaForms(lemma);
  return examples.some((example) => {
    const text = String(example ?? "").toLowerCase();
    return forms.some((form) => new RegExp(`(^|[^a-z])${escapeRegExp(form)}([^a-z]|$)`, "i").test(text));
  });
}


function cleanText(value: string) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}


const POLISH_DIACRITICS_RE = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

function hasPolishDiacritics(value: string) {
  return POLISH_DIACRITICS_RE.test(value);
}

function foldPolishToAscii(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/ą/g, "a")
    .replace(/ć/g, "c")
    .replace(/ę/g, "e")
    .replace(/ł/g, "l")
    .replace(/ń/g, "n")
    .replace(/ó/g, "o")
    .replace(/ś/g, "s")
    .replace(/ź/g, "z")
    .replace(/ż/g, "z");
}

function stripTranslationPatternForLeakCheck(value: string) {
  return cleanText(value)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/["“”„]/g, "")
    .trim();
}

// Words that are valid English tokens too, or are common internationalisms.
// These must not fail examples such as "benefit plan" or "This book is a bestseller".
const SHARED_EN_PL_TOKENS = new Set([
  "app",
  "bank",
  "bar",
  "bonus",
  "bestseller",
  "best-seller",
  "bus",
  "data",
  "email",
  "film",
  "final",
  "hotel",
  "internet",
  "menu",
  "online",
  "plan",
  "program",
  "radio",
  "sport",
  "status",
  "system",
  "taxi",
  "test",
  "trend",
]);

// Polish words without diacritics that the model has actually leaked into English examples.
// Keep this list intentionally conservative to avoid false positives on normal English words.
const POLISH_ASCII_LEAK_TOKENS = new Set([
  "aplikacja",
  "faktura",
  "harmonogram",
  "informacja",
  "komentarz",
  "komplement",
  "kontrakt",
  "kosztorys",
  "kupon",
  "obowiazek",
  "odnawiac",
  "podpis",
  "procedura",
  "rejestracja",
  "reklamacja",
  "rozmowa",
  "sasiad",
  "sasiadka",
  "sasiedztwo",
  "skarga",
  "umowa",
  "wniosek",
  "wizyta",
  "zapisy",
  "zgoda",
]);

function sourceTranslationLeakTokens(lemma: string, translation: string) {
  const lemmaKey = cleanText(lemma).toLowerCase();
  const translationPattern = stripTranslationPatternForLeakCheck(translation).toLowerCase();
  const tokens = translationPattern
    .split(/\s+/)
    .map((word) => word.replace(/[.,;:!?()]/g, "").trim().toLowerCase())
    .filter((word) =>
      word.length >= 4 &&
      word !== lemmaKey &&
      !SHARED_EN_PL_TOKENS.has(word)
    );

  const leakTokens = new Set<string>();

  for (const token of tokens) {
    if (hasPolishDiacritics(token)) {
      leakTokens.add(token);
      const folded = foldPolishToAscii(token);
      if (folded.length >= 4 && !SHARED_EN_PL_TOKENS.has(folded)) leakTokens.add(folded);
      continue;
    }

    if (POLISH_ASCII_LEAK_TOKENS.has(token)) leakTokens.add(token);
  }

  return Array.from(leakTokens);
}

function exampleContainsToken(example: string, token: string) {
  return new RegExp(`(^|[^a-zA-Z])${escapeRegExp(token)}([^a-zA-Z]|$)`, "i").test(example);
}

function containsSourceLanguageLeakageInExample(lemma: string, translation: string, value: string) {
  const example = cleanText(value);
  if (POLISH_DIACRITICS_RE.test(example)) return true;

  return sourceTranslationLeakTokens(lemma, translation).some((token) =>
    exampleContainsToken(example, token)
  );
}

function splitOnTopLevelSlashes(value: string) {
  const text = cleanText(value).toLowerCase();
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);

    if (char === "/" && depth === 0) {
      parts.push(cleanText(current));
      current = "";
      continue;
    }

    current += char;
  }

  parts.push(cleanText(current));
  return parts.filter(Boolean);
}

function hasTopLevelSlash(value: string) {
  return splitOnTopLevelSlashes(value).length > 1;
}

function hasTopLevelSemicolon(value: string) {
  const text = cleanText(value);
  let depth = 0;

  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === ";" && depth === 0) return true;
  }

  return false;
}

function splitOnTopLevelCommas(value: string) {
  const text = cleanText(value).toLowerCase();
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);

    if (char === "," && depth === 0) {
      parts.push(cleanText(current));
      current = "";
      continue;
    }

    current += char;
  }

  parts.push(cleanText(current));
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
  const text = cleanText(value).toLowerCase();
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

function parentheticalNotesAreAllowed(value: string) {
  const text = cleanText(value).toLowerCase();
  const matches = Array.from(text.matchAll(/\(([^)]*)\)/g));
  if (matches.length === 0) return true;

  const allowedFullTranslations = new Set([
    "pożyczyć (od kogoś)",
    "pożyczać (od kogoś)",
    "pożyczyć (komuś)",
    "pożyczać (komuś)",
    "wypożyczyć (z biblioteki)",
    "odmówić (czegoś komuś)",
    "uważać (kogoś za)",
    "uważać (kogoś/coś za)",
    "ubiegać się (o coś)",
  ]);

  if (allowedFullTranslations.has(text)) return true;

  return matches.every((match) => {
    const inside = cleanText(match[1]).toLowerCase();

    const hasRelationalPronoun =
      /\b(kogoś|komuś|czegoś|coś|kimś|czymś|sobie|kogo|komu|czemu|czym|kim)\b/.test(inside);

    const startsWithUsefulPreposition =
      /^(od|do|o|na|za|dla|z|ze|w|we|przez)\s+/.test(inside);

    const allowedMeaningPattern =
      hasRelationalPronoun ||
      (startsWithUsefulPreposition && /\b(kogoś|czegoś|coś|kimś|czymś|kogo|komu|czym|kim|biblioteki)\b/.test(inside));

    const clearlyForbidden =
      inside.includes(",") ||
      /decyz|termin|ostatecz|pienięd|kwot|formaln|produkt|plan|kontekst|spotkan|wizyt|zasad|umow|koszt|faktur|np\.?|czyli/.test(inside) ||
      inside === "się";

    return allowedMeaningPattern && !clearlyForbidden;
  });
}

const COMMON_POLYSEMOUS_WARNING_LEMMAS = new Set([
  "present",
  "issue",
  "apply",
  "request",
  "schedule",
  "refund",
  "estimate",
  "increase",
  "influence",
  "express",
  "consider",
  "maintain",
  "resolve",
  "arrange",
  "deliver",
  "challenge",
  "attribute",
  "contrast",
  "compound",
  "exhibit",
  "watch",
  "right",
  "light",
  "sound",
  "turn",
  "state",
  "object",
  "subject",
]);


export function validateFinalBatch(batch: FinalBatch): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (isBlank(batch.target_language)) errors.push("target_language is required");
  if (isBlank(batch.source_language)) errors.push("source_language is required");
  if (!batch.level && !batch.category) errors.push("Either level or category is required");
  if (!Number.isInteger(batch.batch) || batch.batch <= 0) errors.push("batch must be a positive number");
  if (!Array.isArray(batch.entries) || batch.entries.length === 0) errors.push("entries must not be empty");

  const lemmaSet = new Set<string>();

  for (const [entryIndex, entry] of (batch.entries ?? []).entries()) {
    const prefix = `entry[${entryIndex}] ${entry?.lemma ?? "unknown"}`;

    if (isBlank(entry.lemma)) errors.push(`${prefix}: lemma is required`);
    if (entry.lemma !== entry.lemma.toLowerCase()) errors.push(`${prefix}: lemma must be lowercase`);
    if (lemmaSet.has(entry.lemma)) errors.push(`${prefix}: duplicate lemma`);
    lemmaSet.add(entry.lemma);

    if (isBlank(entry.ipa)) errors.push(`${prefix}: ipa is required`);
    if (!CEFR_LEVELS.includes(entry.level)) errors.push(`${prefix}: invalid CEFR level`);
    if (batch.level && entry.level !== batch.level) errors.push(`${prefix}: entry level ${entry.level} does not match root level ${batch.level}`);

    if (!Array.isArray(entry.senses) || entry.senses.length < 1 || entry.senses.length > 5) {
      errors.push(`${prefix}: senses must contain 1-5 items`);
      continue;
    }

    const orders = entry.senses.map((sense) => sense.sense_order);
    const expected = entry.senses.map((_, index) => index + 1);
    if (orders.some((order, index) => order !== expected[index])) {
      errors.push(`${prefix}: sense_order must be sequential starting at 1`);
    }

    if (entry.senses.length === 1 && COMMON_POLYSEMOUS_WARNING_LEMMAS.has(entry.lemma)) {
      warnings.push(`${prefix}: only 1 sense; this lemma is commonly polysemous, check whether a practical sense is missing`);
    }

    for (const sense of entry.senses) {
      const sprefix = `${prefix} sense_order=${sense.sense_order}`;
      if (!POS_VALUES.includes(sense.part_of_speech)) errors.push(`${sprefix}: invalid part_of_speech ${sense.part_of_speech}`);
      if (isBlank(sense.translation?.text)) errors.push(`${sprefix}: translation.text is required`);
      if (!isBlank(sense.translation?.text) && !hasBalancedParentheses(sense.translation.text)) {
        errors.push(`${sprefix}: translation has broken parentheses`);
      }
      if (!isBlank(sense.translation?.text) && hasTopLevelSemicolon(sense.translation.text)) {
        errors.push(`${sprefix}: semicolon translations are not allowed; split into separate senses with separate examples`);
      }
      if (!isBlank(sense.translation?.text) && hasBalancedParentheses(sense.translation.text) && !parentheticalNotesAreAllowed(sense.translation.text)) {
        errors.push(`${sprefix}: parentheses are allowed only for essential meaning direction/relation/complement, e.g. borrow/lend patterns; remove loose usage notes or split into separate senses`);
      }
      if (!isBlank(sense.translation?.text) && hasTopLevelComma(sense.translation.text)) {
        errors.push(`${sprefix}: top-level comma translations are not allowed; split into separate senses or keep the strongest single translation`);
      }
      if (!isBlank(sense.translation?.text) && !isAllowedSlashTranslation(sense.translation.text)) {
        errors.push(`${sprefix}: top-level slash translation merges different meanings; split into separate senses or keep the strongest single translation`);
      }
      const examples = sense.translation?.examples;
      if (!Array.isArray(examples) || examples.length !== 2) {
        errors.push(`${sprefix}: exactly 2 examples required`);
        continue;
      }
      const exampleOrders = examples.map((example) => example.example_order).sort((a, b) => a - b);
      if (exampleOrders[0] !== 1 || exampleOrders[1] !== 2) errors.push(`${sprefix}: example_order must be 1 and 2`);
      if (examples.some((example) => isBlank(example.text))) errors.push(`${sprefix}: example text cannot be empty`);
      for (const example of examples) {
        if (!isBlank(example.text) && containsSourceLanguageLeakageInExample(entry.lemma, sense.translation.text, example.text)) {
          errors.push(`${sprefix}: example contains source-language/Polish leakage; examples must be fully in target_language and must not contain the Polish/source translation: "${cleanText(example.text)}"`);
        }
      }
      if (examples[0]?.text?.trim() === examples[1]?.text?.trim()) errors.push(`${sprefix}: examples must be different`);

      if (Array.isArray(examples) && !examplesUseLemma(entry.lemma, examples.map((example) => example.text))) {
        warnings.push(`${sprefix}: examples may use a derived word instead of the exact lemma/inflection`);
      }
    }
  }

  return { passed: errors.length === 0, errors, warnings };
}
