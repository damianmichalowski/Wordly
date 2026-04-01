/**
 * Krótkie etykiety PL dla `vocabulary_senses.part_of_speech` (schema seed / posMap).
 */
export function partOfSpeechLabel(pos: string): string {
  const k = pos.trim().toLowerCase();
  const map: Record<string, string> = {
    noun: 'Rzeczownik',
    verb: 'Czasownik',
    adj: 'Przymiotnik',
    adv: 'Przysłówek',
    prep: 'Przyimek',
    conj: 'Spójnik',
    pron: 'Zaimek',
    det: 'Determiner',
    num: 'Liczebnik',
    phrase: 'Wyrażenie',
    other: 'Inne',
  };
  return map[k] ?? pos;
}
