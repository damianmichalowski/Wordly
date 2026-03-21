import type { VocabularyWord } from '@/src/types/words';

/** Stable UUIDs — must match `supabase/migrations/*_decks_many_to_many_seed.sql` */
export const MOCK_WORD_IDS = {
  plEnResilient: 'a1000000-0000-4000-8000-000000000001',
  plEnSubtle: 'a1000000-0000-4000-8000-000000000002',
  plEnFeasible: 'a1000000-0000-4000-8000-000000000003',
  enEsInsight: 'a1000000-0000-4000-8000-000000000004',
  enEsCompelling: 'a1000000-0000-4000-8000-000000000005',
  plDeErreichen: 'a1000000-0000-4000-8000-000000000006',
} as const;

export const MOCK_DECK_IDS = {
  wordlySeed: 'b2000000-0000-4000-8000-000000000001',
  plEn: 'b2000000-0000-4000-8000-000000000002',
} as const;

export const mockVocabulary: VocabularyWord[] = [
  {
    id: MOCK_WORD_IDS.plEnResilient,
    sourceLanguageCode: 'pl',
    targetLanguageCode: 'en',
    sourceText: 'odporny',
    targetText: 'resilient',
    exampleSource: 'Musisz być odporny na stres.',
    exampleTarget: 'You need to be resilient under stress.',
    cefrLevel: 'B2',
    pronunciationText: 'resilient',
  },
  {
    id: MOCK_WORD_IDS.plEnSubtle,
    sourceLanguageCode: 'pl',
    targetLanguageCode: 'en',
    sourceText: 'subtelny',
    targetText: 'subtle',
    exampleSource: 'To była subtelna różnica.',
    exampleTarget: 'That was a subtle difference.',
    cefrLevel: 'B2',
    pronunciationText: 'subtle',
  },
  {
    id: MOCK_WORD_IDS.plEnFeasible,
    sourceLanguageCode: 'pl',
    targetLanguageCode: 'en',
    sourceText: 'wykonalny',
    targetText: 'feasible',
    exampleSource: 'Plan jest wykonalny przy tym budżecie.',
    exampleTarget: 'The plan is feasible with this budget.',
    cefrLevel: 'C1',
    pronunciationText: 'feasible',
  },
  {
    id: MOCK_WORD_IDS.enEsInsight,
    sourceLanguageCode: 'en',
    targetLanguageCode: 'es',
    sourceText: 'insight',
    targetText: 'perspectiva',
    exampleSource: 'Your insight helped the team.',
    exampleTarget: 'Tu perspectiva ayudó al equipo.',
    cefrLevel: 'B2',
    pronunciationText: 'perspectiva',
  },
  {
    id: MOCK_WORD_IDS.enEsCompelling,
    sourceLanguageCode: 'en',
    targetLanguageCode: 'es',
    sourceText: 'compelling',
    targetText: 'convincente',
    exampleSource: 'She made a compelling argument.',
    exampleTarget: 'Ella presentó un argumento convincente.',
    cefrLevel: 'C1',
    pronunciationText: 'convincente',
  },
  {
    id: MOCK_WORD_IDS.plDeErreichen,
    sourceLanguageCode: 'pl',
    targetLanguageCode: 'de',
    sourceText: 'osiągnąć',
    targetText: 'erreichen',
    exampleSource: 'Chcę osiągnąć ten cel.',
    exampleTarget: 'Ich will dieses Ziel erreichen.',
    cefrLevel: 'B1',
    pronunciationText: 'erreichen',
  },
];
