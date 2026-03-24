/**
 * Mapowanie etykiet POS z różnych słowników (Oxford, CEFR-J OLP, Words-CEFR itd.)
 * na wartości check constraint w `public.vocabulary_senses.part_of_speech`.
 */
export type SchemaPos = 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'conj' | 'pron' | 'det' | 'num' | 'phrase' | 'other';

const ALIASES: Record<string, SchemaPos> = {
  noun: 'noun',
  n: 'noun',
  verb: 'verb',
  v: 'verb',
  'modal verb': 'verb',
  modal: 'verb',
  adjective: 'adj',
  adj: 'adj',
  adverb: 'adv',
  adv: 'adv',
  preposition: 'prep',
  prep: 'prep',
  conjunction: 'conj',
  conj: 'conj',
  pronoun: 'pron',
  pron: 'pron',
  determiner: 'det',
  det: 'det',
  article: 'det',
  number: 'num',
  num: 'num',
  phrase: 'phrase',
  expression: 'phrase',
  interjection: 'other',
  interj: 'other',
  abbr: 'other',
  abbreviation: 'other',
  other: 'other',
};

export function mapPartOfSpeech(raw: string): SchemaPos | null {
  const k = raw.trim().toLowerCase();
  if (!k) {
    return null;
  }
  return ALIASES[k] ?? null;
}

/** FreeDict: `<pos>N</pos>`, `<pos>V</pos>`, puste → `other`. */
export function mapFreeDictPos(raw: string): SchemaPos {
  const k = raw.trim();
  if (!k) {
    return 'other';
  }
  const one = k.length === 1 ? k.toLowerCase() : k.toLowerCase();
  if (one === 'n') {
    return 'noun';
  }
  return mapPartOfSpeech(one) ?? 'other';
}
