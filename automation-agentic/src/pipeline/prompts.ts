import { CategoryConfig, LemmaPlan, PipelineConfig } from "../types";
import { buildCategoryConfigPrompt } from "./categorySettings";

export type LemmaSearchPressure = "normal" | "expanded" | "frontier" | "exhaustive";

function compactExcluded(excluded: string[], limit: number) {
  const clean = excluded.map((item) => item.trim()).filter(Boolean);
  if (clean.length <= limit) return clean.join(", ");

  // Keep both the beginning and the end of the exclusion list.
  // The end often contains current-run / backfill lemmas, which are the most important
  // to show to the planner to avoid repeated duplicate candidates.
  const headCount = Math.max(0, Math.floor(limit * 0.7));
  const tailCount = Math.max(0, limit - headCount);
  return [...clean.slice(0, headCount), ...clean.slice(-tailCount)].join(", ");
}

function cefrLemmaMix(level?: string) {
  const generic = [
    `Batch balance target for CEFR ${level ?? "level"}:`,
    `- about 50% daily-life / communication / real-world problem-solving vocabulary`,
    `- about 30% work, school, media, relationships, travel, services, general adult life vocabulary`,
    `- about 20% abstract, academic, professional or domain-adjacent vocabulary, but only if broadly useful`,
    `Do not make the batch mostly academic, legal, scientific or technical. Wordly is a daily-life learning app first.`,
  ];

  const byLevel: Record<string, string[]> = {
    A1: [
      `A1 distribution: about 90% survival/daily life/basic communication, 10% school/basic services.`,
      `Use the strongest everyday words only. Avoid abstract, formal and professional vocabulary.`,
    ],
    A2: [
      `A2 distribution: about 80% daily life, 20% travel/work/basic admin/basic services.`,
      `Prefer practical independence: shopping, travel, food, directions, time, simple problems, routine.`,
    ],
    B1: [
      `B1 distribution: about 65% daily life, 25% work/media/social life, 10% abstract vocabulary.`,
      `Prefer flexible real-life communication before formal/academic vocabulary.`,
    ],
    B2: [
      `B2 distribution: about 50% practical daily-life/communication/services/decisions/problems, 30% work/school/media/adult life/formal situations, 20% abstract/professional/domain-adjacent.`,
      `Prefer useful adult-life vocabulary: emails, meetings, complaints, refunds, scheduling, decisions, services, explanations, opinions, plans, responsibilities.`,
    ],
    C1: [
      `C1 distribution: about 35% adult-life/daily nuance, 35% professional/media/formal communication, 30% abstract/academic vocabulary.`,
      `Advanced is allowed, but still prioritize vocabulary an educated user will actually meet.`,
    ],
    C2: [
      `C2 distribution: about 20% practical nuanced language, 35% professional/media/formal communication, 45% abstract/nuanced/advanced vocabulary.`,
      `C2 may be sophisticated, but must not become random dictionary artifacts.`,
    ],
  };

  return [...generic, ...(level ? byLevel[level] ?? [] : [])].join("\n");
}

function categoryProfileRules(config: PipelineConfig, category?: string) {
  if (config.mode !== "category") return "";
  return buildCategoryConfigPrompt(config as CategoryConfig, String(category ?? ""));
}

function lemmaSearchPressureRules(params: {
  pressure?: LemmaSearchPressure;
  level?: string;
  existingCount?: number;
  levelTarget?: number;
}) {
  const pressure = params.pressure ?? "normal";
  const existing = params.existingCount ?? 0;
  const target = params.levelTarget ?? 0;
  const remaining = target > 0 ? Math.max(0, target - existing) : undefined;
  const coverage = target > 0 ? Math.round((existing / target) * 100) : undefined;

  const header = [
    `Adaptive search mode: ${pressure}.`,
    target > 0 ? `Current target coverage is about ${coverage}% (${existing}/${target}); remaining target: ${remaining}.` : `Current exclusion pressure: ${existing} excluded lemmas.`,
  ];

  const expanded = [
    ...header,
    `EXPANDED SEARCH: obvious core lemmas are probably already excluded. Search one layer wider while staying practical and CEFR-appropriate.`,
    `Use safe, common base lemmas from these buckets: everyday decisions, work/school actions, services/admin, problems/solutions, communication, opinions, emotions, travel, money, health, media, technology, environment.`,
    `Prefer flexible base verbs and nouns with real daily examples over rare nouns, invented adjectives, names of tools, legal roles or technical labels.`,
  ];

  const frontier = [
    ...header,
    `FRONTIER SEARCH: the level is close to full. Do not repeat the obvious words. Generate less-obvious but still normal CEFR-level lemmas a learner will meet in real life.`,
    `Act like a careful dictionary editor filling final gaps: choose established words only, not productive inventions.`,
    `Good candidate shapes: base verbs (adjust, approve, assume, clarify, deny, determine, gather, ignore, indicate, obtain), useful abstract nouns (attitude, barrier, benefit, doubt, estimate), and practical adjectives/adverbs (aware, brief, domestic).`,
    `If a candidate feels legal-only, academic-only, technical-only, archaic, or made from a suffix just to fill space, reject it and choose another.`,
  ];

  const exhaustive = [
    ...header,
    `LAST-MILE EXHAUSTIVE SEARCH: only a small number of words may be missing. Search broadly but safely across remaining common CEFR-level vocabulary.`,
    `Do not panic-fill. Never output fake forms such as arriveer, mentionabletest, receiveable, replyable, glued compounds, or rare job/legal labels.`,
    `Prefer clean canonical lemmas that can support natural examples immediately. Strong last-mile families: communication/reporting, agreement/disagreement, change/control, cause/effect, duties/rules, help/support, risk/safety, money/services, movement/location, learning/work.`,
    `It is better to return fewer excellent candidates than many questionable ones, but try hard to reach the requested count with real established lemmas not in the excluded list.`,
  ];

  if (pressure === "exhaustive") return exhaustive.join("\n");
  if (pressure === "frontier") return frontier.join("\n");
  if (pressure === "expanded") return expanded.join("\n");
  return [
    ...header,
    `NORMAL SEARCH: prioritize the strongest, most frequent and most useful CEFR/category lemmas.`,
  ].join("\n");
}

export function buildLemmaPlannerPrompt(params: {
  config: PipelineConfig;
  level?: string;
  category?: string;
  batch: number;
  size: number;
  excluded: string[];
  searchPressure?: LemmaSearchPressure;
  existingCount?: number;
  levelTarget?: number;
}) {
  const { config, level, category, batch, size, excluded } = params;

  const commonRules = [
    `Task: choose ${size} high-value lemmas for Wordly vocabulary data.`,
    `Target language: ${config.target_language}. Source language: ${config.source_language}.`,
    `Return ONLY JSON. No markdown.`,
    `Schema: {"target_language":"${config.target_language}","source_language":"${config.source_language}","${config.mode === "cefr" ? "level" : "category"}":"...","batch":${batch},"lemmas":[{"lemma":"...","ipa":"/.../","level":"A1|A2|B1|B2|C1|C2"}]}`,
    `lemma lowercase. Use canonical dictionary lemmas only: base infinitive verbs, singular nouns, plain adjectives/adverbs. Do NOT output inflected forms such as mentioned, borrowed, travelled, ends, departures, confirming, launching. Phrasal verbs allowed as separate lemmas only when they are true lexical phrasal verbs, e.g. give up, look after, put off. Do NOT create ordinary verb+preposition/collocation lemmas like negotiate with, complain about, request for. Prefer the base lemma. No duplicates. IPA required.`,
    `BROKEN LEMMA GUARD: never output repair/debug artifacts or generated strings containing replaced, -replaced, availablely, procedureal, explaination, accessibleable, communicateable, describeable, approveable, controlable, includeable, negotiateable, prepareable, estimateable, createable, receiveable, replyable, arriveer, mentionabletest.`,
    `NO GLUED WORDS: do not concatenate phrases or compounds. Bad: createaccount, feedbackform, bankaccount, meetingroom, meetingplace, chargephone, issuecard, invoiceid, policyholderinfo, deadlineextension, estimatecost, savefile, repairshop, hangon, dealwith. Use a normal single base lemma instead; only use multi-word lemmas when they are established lexical items and written with spaces.`,
    `NO INVENTED -ABLE WORDS: do not create productive -able adjectives from verbs just to fill the batch. Avoid generated lemmas like confirmable, contactable, mentionable, issueable, feedbackable, consentable, handleable, invoiceable, boostable, requestable, surveyable, chargeable, searchable, explainable. Common established adjectives are allowed, e.g. comfortable, capable, suitable, available, valuable, reasonable, noticeable, fashionable, knowledgeable.`,
    lemmaSearchPressureRules({ pressure: params.searchPressure, level, existingCount: params.existingCount, levelTarget: params.levelTarget }),
    `HARD EXCLUSION RULE: do NOT output any lemma from the excluded list. In CEFR these are already in the database/local registry; in CATEGORY these are already attached to the current category. Replace them with different useful lemmas. Excluded: ${compactExcluded(excluded, config.limits.excluded_lemmas_limit)}`,
    `Before returning, compare every candidate against the excluded list. If a candidate appears there, remove it and choose another non-excluded lemma.`,
    `Pick the most useful, most common, most practical lemmas for a mobile daily-word app.`,
    `Prioritize communication value: words that help the learner speak, understand, ask, answer, work, travel, explain, react, and solve everyday situations.`,
    `Avoid filler, rare, overly literary, overly technical, overly scientific, overly legal, or obscure words unless they are broadly useful at this level.`,
    `Prefer lemmas that can be useful as Daily Word: immediately understandable, practical, and likely to appear in real life.`,
  ];

  if (config.mode === "cefr") {
    commonRules.push(
      `Mode: CEFR. Level is strict: ${level}. Every lemma.level must be ${level}.`,
      `Choose words clearly appropriate for ${level}; verify CEFR fit carefully. If the word feels easier/harder, niche, too formal, or borderline for ${level}, skip and choose another.`,
      cefrLemmaMix(level)
    );
  } else {
    commonRules.push(
      `Mode: CATEGORY. Category is strict: ${category}.`,
      `Every lemma must strongly belong to category ${category}. Do not add weak associations.`,
      `Assign realistic CEFR per lemma, A1-C2.`,
      categoryProfileRules(config, category),
      `SPECIALIZED SHARE: specialized vocabulary should be meaningfully represented. Do not keep it at only a tiny 10%; use the profile percentage, usually 20-35%, while still rejecting rare/low-value jargon.`,
      `Prefer words that help the learner operate in the category, including professional/specialist words when the category is a field of work.`
    );
  }

  return {
    system: "You are a senior CEFR/category vocabulary planner. You output compact valid JSON only.",
    user: commonRules.join("\n"),
  };
}

export function buildSenseExplorerPrompt(params: {
  config: PipelineConfig;
  plan: LemmaPlan;
  category?: string;
}) {
  const { config, plan, category } = params;
  const maxCandidates = config.limits.max_candidates_per_lemma;
  const maxFinal = config.limits.max_final_senses_per_lemma;
  const lemmas = plan.lemmas.map((item) => ({ lemma: item.lemma, ipa: item.ipa, level: item.level }));

  const rules = [
    `Task: enrich lemmas with common practical senses for a language app.`,
    `IMPORTANT DATABASE MEANING: in Wordly, a "sense" is a separate useful translation/use-case for the learner, not only a completely different dictionary meaning.`,
    `For each lemma, choose the best practical translation first, then the next useful/common translation, then another worthwhile translation/use-case if it exists.`,
    `Near-synonym Polish translations may be separate senses when they teach a useful different rendering or usage pattern and examples make that usage natural.`,
    `Prefer showing useful coverage across parts of speech when relevant. Example: present can include noun=prezent, noun=teraźniejszość, adjective=obecny, verb=prezentować.`,
    `Target language: ${config.target_language}. Source language: ${config.source_language}.`,
    `Return ONLY JSON. No markdown.`,
    `Output compact schema: {"target_language":"${config.target_language}","source_language":"${config.source_language}","${config.mode === "cefr" ? "level" : "category"}":"${config.mode === "cefr" ? plan.level : category}","batch":${plan.batch},"entries":[{"lemma":"...","ipa":"/.../","level":"B2","candidates":[{"pos":"noun|verb|adjective|adverb|preposition|phrase|other","tr":"polish translation","score":1,"ex":["example 1","example 2"]}]}]}`,
    `For each lemma, search across parts of speech: noun, verb, adjective, adverb, phrase/preposition if applicable. Do not stop at the first obvious translation.`,
    `Return up to ${maxCandidates} candidates per lemma. The final assembler may keep up to ${maxFinal} senses.`,
    `Scoring: 5=must keep, most common/highest learner value; 4=strong practical translation/use-case; 3=useful but secondary; 2=weak/context-specific; 1=skip-worthy.`,
    `Prefer 3-5 strong final-worthy senses for common/polysemous lemmas when genuinely useful; 1 is fine only if the lemma truly has one useful common translation.`,
    `Different part of speech matters. If a common lemma works as noun + adjective + verb and those translations are practical, include those candidates.`,
    `For common multi-POS lemmas, do not stop at 2 senses if the exact lemma clearly has more common, practical translations/use-cases.`,
    `Important example: for present, good common candidates include noun=prezent, noun=teraźniejszość, adjective=obecny, verb=prezentować. Optional verb=podarować only if examples stay natural and useful. Do not combine these with slash/comma; each useful translation should be its own candidate.`,
    `Do not list every dictionary meaning. Include only common, practical, learner-useful translations/use-cases.`
    + "\n" +
    `PHRASE LEMMA RULE: Do not add extra entries that were not in the lemma plan. Do not convert a base lemma into a prepositional phrase entry such as negotiate with. Such usage belongs as an example/sense of negotiate, not as a new lemma.`,
    `Translations must be in ${config.source_language}, natural and concise.`,
    `PARENTHESIS RULE: parentheses are allowed ONLY when they clarify the meaning pattern, direction, required object, or relationship that is essential for understanding the translation. Good: borrow -> "pożyczyć (od kogoś)", lend -> "pożyczyć (komuś)", consider -> "uważać (kogoś/coś za)", apply -> "ubiegać się (o coś)".`,
    `Do NOT use parentheses as loose usage notes, domains, examples, or UI clutter. Bad: "zatwierdzić (decyzję)", "odroczyć (decyzję)", "termin (ostateczny)", "przełożyć (na inny termin)", "potrzebować (formal)", "zwrot (pieniędzy)" unless the parenthetical is truly needed to distinguish meaning direction/relationship. Prefer clean translation or separate candidate.`,
    `SEMICOLON RULE: never use semicolons in translation.text. If two translations are useful, create separate candidates/senses with separate examples. Bad: contract -> "zawrzeć umowę; zatrudnić". Good: candidate 1 "zawrzeć umowę" with contract-signing examples; candidate 2 "zatrudnić na kontrakt" with hiring/contracting examples.`,
    `COMMA TRANSLATION RULE: never use a top-level comma to list multiple Polish translations in one candidate. Do NOT output translations like "okolica, sąsiedztwo", "spotkanie umówione, wizyta", "procedura, procedury", "sugerować, proponować", "radzić, doradzać".`,
    `If two Polish translations separated by a comma would both be useful, output separate candidates with separate examples. If they are just plural/singular or a weak duplicate, keep only the strongest singular form.`,
    `Bad comma examples: neighbourhood -> "okolica, sąsiedztwo". Good: candidate 1 "okolica" with area examples; candidate 2 "sąsiedztwo" only if examples show community/neighbourhood relation.`,
    `Bad: appointment -> "spotkanie umówione, wizyta". Good: candidate 1 "wizyta" for doctor/consultant; candidate 2 "mianowanie" for appointed role, if useful. For business meeting use "spotkanie" only if examples clearly show meeting.`,
    `Bad: procedure -> "procedura, procedury". Good: "procedura" only; plural-only variants are not separate meanings.`,
    `Parentheses may contain compact meaning patterns, e.g. "pożyczyć (od kogoś)", "pożyczyć (komuś)", "uważać (kogoś/coś za)". A slash inside parentheses is NOT a slash translation and must not be split. Keep parentheses balanced.`,
    `SLASH TRANSLATION RULE: avoid slash translations by default. Use top-level slash ONLY for true gender variants or the same exact masculine/feminine concept, e.g. "sąsiad/sąsiadka", "kolega/koleżanka z pracy". Do NOT use slash to merge synonyms, roles, actions, contexts, or learner-useful alternatives.`,
    `Bad slash translations that must be split into separate candidates or replaced by the strongest single translation: "zatwierdzić/upewnić się", "odwołać/anulować", "przełożony/kierownik", "zaplanować/umówić", "harmonogram/plan", "problem/zagadnienie", "stosować/zastosować".`,
    `QUALITY EXAMPLES TO FOLLOW: priority should prefer candidates like "priorytet" and, if separately useful, "pierwszeństwo". Do not output awkward translations like "zadanie pierwszorzędne".`,
    `QUALITY EXAMPLES TO FOLLOW: responsibility should prefer "odpowiedzialność", "obowiązek", or "zakres odpowiedzialności" depending on examples. Do not use weak translation "zadanie" for responsibility.`,
    `QUALITY EXAMPLES TO FOLLOW: transfer should be split by real use: noun "przelew", verb/noun "przeniesienie/przenieść", possibly travel/transport transfer if practical. Do not combine "przeniesienie, przelew" in one candidate.`,
    `When a Polish translation sounds unnatural, artificial, overly literal, or clumsy, replace it with the natural learner-first translation even if it is less dictionary-like.`,
    `If two Polish translations would teach the learner different usage, output them as separate candidates with different example sentences, or choose the stronger one. Do not hide different meanings inside one slash translation.`,
    `CRITICAL SPLIT RULE: when a top-level slash contains two different learner-useful meanings/actions/roles, do NOT output the slash. Create separate candidates instead, each with its own examples that clearly show that specific meaning.`,
    `Bad: confirm -> "zatwierdzić/upewnić się" with the same examples. Good: candidate 1 "zatwierdzić" examples about approving a decision; candidate 2 "upewnić się" examples about checking details.`,
    `Bad: cancel -> "odwołać/anulować". Good: candidate 1 "odwołać" examples about meetings/events; candidate 2 "anulować" examples about orders/subscriptions/bookings.`,
    `Bad: supervisor -> "przełożony/kierownik". Good: choose the stronger one OR create two noun candidates only if you can write clearly different examples: "przełożony" for reporting/approval hierarchy, "kierownik" for managing a team/store/department.`,
    `Allowed slash exception: gender-only variants or the same exact concept, e.g. "sąsiad/sąsiadka". Do not split those.`,
    `Every separate candidate must earn its place with natural examples that fit that Polish translation/use-case. If two candidates are almost identical and examples cannot show a useful difference, keep only the stronger one.`,
    `Do not output multiple candidates with the exact same example pair. Similar meanings are allowed only when the Polish translation or usage pattern is learner-useful and examples are natural.`,
    `EXACT LEMMA RULE: examples must use the exact lemma or a true inflected form of that lemma. Do not create senses based on derived words.`,
    `Bad: lemma arrange -> noun examples with arrangement/arrangements. "arrangement" is a different lemma.`,
    `Good: lemma arrange -> arrange, arranges, arranged, arranging.`,
    `Bad: lemma responsible -> responsibility. Bad: lemma decide -> decision. Bad: lemma employ -> employment. These are separate lemmas.`,
    `Examples must be in ${config.target_language}, natural, short/medium, and use the lemma or its true inflected form. Exactly 2 examples per candidate.`,
    `Examples must be 100% in ${config.target_language}; never insert ${config.source_language} words/translations inside examples, even without diacritics.`,
    `If you are tempted to use the Polish/source translation inside the sentence, replace it with the English lemma or a natural English inflection.`,
    `IPA is per lemma because the database has only one ipa field. Use the most standard/common English pronunciation for the lemma as a whole. Do not create separate IPA per POS, and do not reject useful noun/verb/adjective senses only because pronunciation may vary by POS.`,
  ];

  if (config.mode === "cefr") {
    rules.push(
      `CEFR level is strict: ${plan.level}. Before returning each lemma and each candidate, verify it is clearly appropriate for ${plan.level}; if uncertain or borderline, skip it. Extra senses may be included only if examples stay appropriate and practical for ${plan.level}.`,
      cefrLemmaMix(plan.level),
      `Sense balance: daily-life/common communication senses first; include academic/work/professional senses only when broadly useful.`,
      `Do not let the batch become mostly academic vocabulary.`
    );
  } else {
    rules.push(
      `Category: ${category}. Include senses useful for this category plus common core senses needed to understand the lemma. Avoid irrelevant rare meanings.`,
      categoryProfileRules(config, category),
      `Category sense balance: category-relevant senses first, then broadly useful everyday senses if they are common.`,
      `For professional/domain categories, include specialized senses when they are genuinely used in that world; do not flatten everything into general English.`
    );
  }

  rules.push(`Lemmas: ${JSON.stringify(lemmas)}`);

  return {
    system: "You are a senior lexicographer for CEFR vocabulary data. You output compact valid JSON only.",
    user: rules.join("\n"),
  };
}

export function buildRepairPrompt(params: { config: PipelineConfig; jsonText: string; errors: string[] }) {
  return {
    system: "You repair JSON for a vocabulary import pipeline. Fix only schema/format issues. Keep linguistic content unless invalid. Return JSON only.",
    user: [
      `Target language: ${params.config.target_language}. Source language: ${params.config.source_language}.`,
      `Required final schema: {target_language,source_language,level/category,batch,entries:[{lemma,ipa,level,senses:[{sense_order,part_of_speech,translation:{text,examples:[{text,example_order}]}}]}]}`,
      `Rules: 1-${params.config.limits.max_final_senses_per_lemma} senses, sense_order sequential, exactly 2 examples with example_order 1 and 2, POS allowed noun verb adjective adverb preposition phrase other, no nulls, no empty strings. In Wordly, a sense is a separate useful translation/use-case, not only a completely different dictionary meaning.`,
      `Do not introduce new bad lemmas while repairing. Reject repair/debug artifacts and generated lemmas containing replaced, glued compounds such as createaccount/feedbackform/bankaccount, inflected forms such as mentioned/borrowed/travelled, and invented -able words such as feedbackable/confirmable/contactable.`,
      `Top-level comma translations are not allowed. Split them into separate senses with different examples or keep the strongest single translation. Slash translations are allowed only for true gender variants such as sąsiad/sąsiadka or kolega/koleżanka. Split or simplify top-level slash translations that merge different meanings/actions/roles.`,
      `Semicolons in translation.text are not allowed. If a translation contains two meanings, split them into separate senses with separate examples. Example: "zawrzeć umowę; zatrudnić" must become two senses/candidates, not one translation.`,
      `Do not split slashes inside balanced parentheses, e.g. "uważać (kogoś/coś za)" is one translation pattern.`,
      `Parentheses in translations are allowed only when they clarify essential meaning pattern/direction/relationship, e.g. borrow/lend: "pożyczyć (od kogoś)" vs "pożyczyć (komuś)". Remove loose notes like "(formal)", "(decision)", "(money)", "(final)" or rewrite as a clean separate sense.`,
      `Avoid duplicated example pairs across senses. If two translations use the same two examples, merge/drop the weaker one or create truly different examples. Do not keep plural-only variants such as "procedura, procedury". Prefer natural translations: priority=priorytet/pierwszeństwo as separate senses if needed; responsibility=odpowiedzialność/obowiązek/zakres odpowiedzialności; transfer=przelew/przeniesienie as separate senses.`,
      `Examples must use the exact lemma or a true inflected form. Do not use derived words as evidence for a sense.`,
      `Examples must be 100% in ${params.config.target_language}; never insert ${params.config.source_language} words/translations inside examples.`,
      `Validation errors: ${params.errors.join(" | ")}`,
      `JSON to repair: ${params.jsonText}`,
    ].join("\n"),
  };
}
