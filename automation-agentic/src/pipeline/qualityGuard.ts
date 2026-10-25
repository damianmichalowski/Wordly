import { SenseExplorerResult } from "../types";

export type QualityFix = {
  lemma: string;
  field: "translation" | "example";
  before: string;
  after: string;
  reason: string;
};

export type QualityPolishResult = {
  result: SenseExplorerResult;
  fixes: QualityFix[];
};

function clean(value: string) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeLemma(value: string) {
  return clean(value).toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


const POLISH_DIACRITICS_RE = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

function hasPolishDiacritics(value: string) {
  return POLISH_DIACRITICS_RE.test(value);
}

function foldPolishToAscii(value: string) {
  return clean(value)
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

function stripTranslationPattern(value: string) {
  return clean(value)
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

function exampleContainsToken(example: string, token: string) {
  return new RegExp(`(^|[^a-zA-Z])${escapeRegExp(token)}([^a-zA-Z]|$)`, "i").test(example);
}

function sourceTranslationLeakTokens(lemma: string, translation: string) {
  const lemmaKey = normalizeLemma(lemma);
  const translationPattern = stripTranslationPattern(translation).toLowerCase();
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

function containsSourceLanguageLeakage(lemma: string, translation: string, example: string) {
  const normalizedExample = clean(example);
  if (POLISH_DIACRITICS_RE.test(normalizedExample)) return true;

  return sourceTranslationLeakTokens(lemma, translation).some((token) =>
    exampleContainsToken(normalizedExample, token)
  );
}

function fixSourceLanguageLeakage(lemma: string, translation: string, example: string) {
  let next = clean(example);
  if (!containsSourceLanguageLeakage(lemma, translation, next)) return next;

  const replacement = clean(lemma);
  const translationPattern = stripTranslationPattern(translation);

  // Most common model mistake: it inserts the source-language translation inside the target-language example,
  // e.g. "time to doprecyzować the figures" or "The terms of the umowa were negotiated".
  // Replace leaked source tokens with the English lemma. Validation catches leftovers.
  if (translationPattern && containsSourceLanguageLeakage(lemma, translation, next)) {
    next = next.replace(new RegExp(escapeRegExp(translationPattern), "gi"), replacement);
  }

  for (const word of sourceTranslationLeakTokens(lemma, translation)) {
    next = next.replace(new RegExp(`(^|[^a-zA-Z])${escapeRegExp(word)}([^a-zA-Z]|$)`, "gi"), `$1${replacement}$2`);
  }

  return clean(next);
}


const ALLOWED_FULL_PARENTHESES_TRANSLATIONS = new Set([
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

function stripDisallowedParentheticalNotes(text: string) {
  const original = clean(text);
  const lower = original.toLowerCase();
  if (!original.includes("(") || !original.includes(")")) return original;
  if (ALLOWED_FULL_PARENTHESES_TRANSLATIONS.has(lower)) return original;

  return clean(original.replace(/\s*\(([^)]*)\)/g, (match, insideRaw) => {
    const inside = clean(insideRaw).toLowerCase();

    // Parentheses may clarify essential meaning direction/relation/complement.
    // Good: "pożyczyć (od kogoś)", "pożyczyć (komuś)", "uważać (kogoś/coś za)", "ubiegać się (o coś)".
    // Bad: "zatwierdzić (decyzję)", "termin (ostateczny)", "zwrot (pieniędzy)", "potrzebować (formal)".
    const hasRelationalPronoun =
      /\b(kogoś|komuś|czegoś|coś|kimś|czymś|sobie|kogo|komu|czemu|czym|kim)\b/.test(inside);

    const startsWithUsefulPreposition =
      /^(od|do|o|na|za|dla|z|ze|w|we|przez)\s+/.test(inside);

    const allowedMeaningPattern =
      hasRelationalPronoun ||
      (startsWithUsefulPreposition && /\b(kogoś|czegoś|coś|kimś|czymś|kogo|komu|czym|kim|biblioteki)\b/.test(inside));

    const clearlyForbidden =
      inside.includes(",") ||
      /decyz|termin|ostatecz|pienięd|kwot|formaln|produkt|plan|kontekst|spotkan|wizyt|zasad|umow|koszt|faktur|np\.?|czyli|np /.test(inside) ||
      inside === "się";

    if (clearlyForbidden) return "";
    if (allowedMeaningPattern) return match;

    return "";
  }));
}

function fixPolishDiacritics(text: string) {
  let next = clean(text);

  const replacements: Array<[RegExp, string]> = [
    [/\bmaterial dowodowy\b/gi, "materiał dowodowy"],
    [/\bmaterialy dowodowe\b/gi, "materiały dowodowe"],
    [/\bbrac pod uwage\b/gi, "brać pod uwagę"],
    [/\bbrac\b/gi, "brać"],
    [/\bzapytac\b/gi, "zapytać"],
    [/\bspoleczny\b/gi, "społeczny"],
    [/\bspoleczna\b/gi, "społeczna"],
    [/\bspoleczne\b/gi, "społeczne"],
    [/\bzlozyc\b/gi, "złożyć"],
    [/\bzlożyć\b/gi, "złożyć"],
    [/\bprzelozyc\b/gi, "przełożyć"],
    [/\bwyjasnic\b/gi, "wyjaśnić"],
    [/\bzaplanowac\b/gi, "zaplanować"],
    [/\bpotwierdzic\b/gi, "potwierdzić"],
    [/\bodpowiedzialnosc\b/gi, "odpowiedzialność"],
    [/\bsasiedztwo\b/gi, "sąsiedztwo"],
    [/\bsasiad\b/gi, "sąsiad"],
    [/\bsasiadka\b/gi, "sąsiadka"],
  ];

  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }

  return clean(next);
}

function fixKnownTranslationIssue(lemma: string, translation: string, examples: string[]) {
  const l = normalizeLemma(lemma);
  const tr = clean(translation).toLowerCase();
  const joinedExamples = examples.map(clean).join(" | ").toLowerCase();

  if (l === "compliment" && /\bgratul/.test(tr)) {
    return "pochwalić";
  }

  if (l === "priority" && /zadanie pierwszorzędne|zadanie priorytetowe/.test(tr)) {
    return joinedExamples.includes("priority over") || joinedExamples.includes("give priority") ? "pierwszeństwo" : "priorytet";
  }

  if (l === "responsibility" && tr === "zadanie") {
    return "obowiązek";
  }

  if (l === "arrange" && tr === "rozstawić") {
    return joinedExamples.includes("chairs") || joinedExamples.includes("products") || joinedExamples.includes("shelf")
      ? "ustawić"
      : "ułożyć";
  }

  if (l === "accommodate" && /dostosować/.test(tr) && joinedExamples.includes("schedule was accommodated")) {
    return "uwzględnić";
  }

  return translation;
}

function fixKnownExampleIssue(lemma: string, translation: string, example: string) {
  const l = normalizeLemma(lemma);
  let next = clean(example);

  next = next.replace(/\bThe data justifies\b/g, "The data justify");
  next = next.replace(/\bthe data justifies\b/g, "the data justify");
  next = next.replace(/\bData justifies\b/g, "Data justify");
  next = next.replace(/\bdata justifies\b/g, "data justify");

  if (l === "accommodate" && /schedule was accommodated/i.test(next)) {
    if (/dostosować|uwzględnić/i.test(translation)) {
      return "We can accommodate your request.";
    }
  }

  if (l === "accommodate" && /suit everyone/i.test(next) && /was accommodated/i.test(next)) {
    return "The hotel accommodated our needs.";
  }

  return clean(next);
}

function noteFix(fixes: QualityFix[], lemma: string, field: QualityFix["field"], before: string, after: string, reason: string) {
  const cleanBefore = clean(before);
  const cleanAfter = clean(after);
  if (cleanBefore === cleanAfter) return;
  fixes.push({ lemma, field, before: cleanBefore, after: cleanAfter, reason });
}

export function polishSenseExplorerResult(input: SenseExplorerResult): QualityPolishResult {
  const result: SenseExplorerResult = JSON.parse(JSON.stringify(input));
  const fixes: QualityFix[] = [];

  for (const entry of result.entries ?? []) {
    const lemma = normalizeLemma(entry.lemma);

    for (const candidate of entry.candidates ?? []) {
      const originalTranslation = clean(candidate.tr);
      const examples = Array.isArray(candidate.ex) ? candidate.ex.map(clean) : [];

      let translation = fixPolishDiacritics(originalTranslation);
      translation = stripDisallowedParentheticalNotes(translation);
      const afterKnownTranslation = fixKnownTranslationIssue(lemma, translation, examples);
      if (afterKnownTranslation !== translation) {
        translation = afterKnownTranslation;
      }

      noteFix(
        fixes,
        lemma,
        "translation",
        originalTranslation,
        translation,
        originalTranslation !== fixPolishDiacritics(originalTranslation) ? "polish_diacritics" : "known_translation_quality"
      );
      candidate.tr = translation;

      if (Array.isArray(candidate.ex)) {
        candidate.ex = candidate.ex.map((example) => {
          const originalExample = clean(example);
          let fixedExample = fixKnownExampleIssue(lemma, translation, originalExample);
          const afterSourceLeakageFix = fixSourceLanguageLeakage(lemma, translation, fixedExample);
          noteFix(fixes, lemma, "example", originalExample, fixedExample, "known_example_quality");
          noteFix(fixes, lemma, "example", fixedExample, afterSourceLeakageFix, "source_language_leakage");
          return afterSourceLeakageFix;
        });
      }
    }
  }

  return { result, fixes };
}
