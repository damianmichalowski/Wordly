-- ==========================================================
-- Wordly: Development seed data
-- Inserts sample English vocabulary with Polish translations
-- across all CEFR levels and categories.
-- ==========================================================

-- Helper: look up IDs by code so seeds work regardless of UUID generation
DO $$
DECLARE
  -- languages
  v_en uuid := (SELECT id FROM public.language WHERE code = 'en');
  v_pl uuid := (SELECT id FROM public.language WHERE code = 'pl');
  v_de uuid := (SELECT id FROM public.language WHERE code = 'de');
  v_es uuid := (SELECT id FROM public.language WHERE code = 'es');

  -- cefr levels
  v_a1 uuid := (SELECT id FROM public.cefr_level WHERE code = 'A1');
  v_a2 uuid := (SELECT id FROM public.cefr_level WHERE code = 'A2');
  v_b1 uuid := (SELECT id FROM public.cefr_level WHERE code = 'B1');
  v_b2 uuid := (SELECT id FROM public.cefr_level WHERE code = 'B2');
  v_c1 uuid := (SELECT id FROM public.cefr_level WHERE code = 'C1');
  v_c2 uuid := (SELECT id FROM public.cefr_level WHERE code = 'C2');

  -- parts of speech
  v_noun uuid := (SELECT id FROM public.part_of_speech WHERE code = 'noun');
  v_verb uuid := (SELECT id FROM public.part_of_speech WHERE code = 'verb');
  v_adj  uuid := (SELECT id FROM public.part_of_speech WHERE code = 'adjective');
  v_adv  uuid := (SELECT id FROM public.part_of_speech WHERE code = 'adverb');
  v_phrase uuid := (SELECT id FROM public.part_of_speech WHERE code = 'phrase');

  -- categories
  v_general  uuid := (SELECT id FROM public.category WHERE code = 'general');
  v_business uuid := (SELECT id FROM public.category WHERE code = 'business');
  v_tech     uuid := (SELECT id FROM public.category WHERE code = 'technology');
  v_travel   uuid := (SELECT id FROM public.category WHERE code = 'travel');
  v_health   uuid := (SELECT id FROM public.category WHERE code = 'health');
  v_edu      uuid := (SELECT id FROM public.category WHERE code = 'education');
  v_finance  uuid := (SELECT id FROM public.category WHERE code = 'finance');
  v_sw_dev   uuid := (SELECT id FROM public.category WHERE code = 'software_development');
  v_trading  uuid := (SELECT id FROM public.category WHERE code = 'trading');
  v_law      uuid := (SELECT id FROM public.category WHERE code = 'law');

  -- word IDs (declared here, assigned per INSERT)
  w_id uuid;
  s_id uuid;
  st_id uuid;
BEGIN

-- ============ A1 WORDS (Beginner) ============

-- 1. apple
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'apple', v_a1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_general);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'jabłko') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'I eat an apple every day.', 1);
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'The apple is red.', 2);

-- 2. water
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'water', v_a1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_general);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'woda') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'Can I have some water?', 1);
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'Water is essential for life.', 2);

-- 3. house
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'house', v_a1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_general);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'dom') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'My house is near the park.', 1);

-- 4. run
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'run', v_a1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_general);
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_health);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_verb, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'biegać') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'I run every morning.', 1);

-- 5. big
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'big', v_a1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_general);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_adj, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'duży') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'The dog is very big.', 1);

-- 6. book
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'book', v_a1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_general);
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_edu);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'książka') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'I read a book every week.', 1);

-- 7. eat
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'eat', v_a1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_general);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_verb, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'jeść') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'We eat dinner at seven.', 1);

-- 8. school
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'school', v_a1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_edu);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'szkoła') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'The children go to school.', 1);

-- ============ A2 WORDS (Beginner) ============

-- 9. journey
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'journey', v_a2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_travel);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'podróż') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'The journey took three hours.', 1);

-- 10. comfortable
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'comfortable', v_a2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_general);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_adj, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'wygodny') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'This chair is very comfortable.', 1);

-- 11. medicine
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'medicine', v_a2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_health);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'lekarstwo') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'Take this medicine twice a day.', 1);

-- 12. airport
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'airport', v_a2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_travel);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'lotnisko') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'We arrived at the airport early.', 1);

-- 13. quickly
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'quickly', v_a2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_general);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_adv, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'szybko') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'She ran quickly to the bus stop.', 1);

-- 14. office
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'office', v_a2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_business);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'biuro') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'I work in an office downtown.', 1);

-- ============ B1 WORDS (Intermediate) ============

-- 15. negotiate
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'negotiate', v_b1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_business);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_verb, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'negocjować') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'We need to negotiate the contract terms.', 1);

-- 16. investment
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'investment', v_b1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_finance);
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_business);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'inwestycja') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'Real estate is a good investment.', 1);

-- 17. algorithm
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'algorithm', v_b1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_tech);
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_sw_dev);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'algorytm') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'The sorting algorithm is very efficient.', 1);

-- 18. symptom
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'symptom', v_b1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_health);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'objaw') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'Fever is a common symptom of the flu.', 1);

-- 19. currency
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'currency', v_b1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_finance);
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_trading);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'waluta') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'The local currency is the zloty.', 1);

-- 20. deadline
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'deadline', v_b1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_business);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'termin') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'The deadline for the project is Friday.', 1);

-- 21. curriculum
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'curriculum', v_b1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_edu);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'program nauczania') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'The school updated its curriculum.', 1);

-- ============ B2 WORDS (Intermediate) ============

-- 22. acquisition
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'acquisition', v_b2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_business);
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_finance);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'przejęcie') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'The acquisition of the startup cost millions.', 1);

-- 23. deploy
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'deploy', v_b2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_sw_dev);
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_tech);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_verb, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'wdrożyć') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'We will deploy the new version tonight.', 1);

-- 24. diagnosis
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'diagnosis', v_b2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_health);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'diagnoza') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'The doctor confirmed the diagnosis.', 1);

-- 25. itinerary
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'itinerary', v_b2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_travel);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'plan podróży') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'Check the itinerary before departure.', 1);

-- 26. legislation
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'legislation', v_b2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_law);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'ustawodawstwo') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'New legislation was passed by parliament.', 1);

-- 27. portfolio
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'portfolio', v_b2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_trading);
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_finance);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'portfel inwestycyjny') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'Diversify your portfolio to reduce risk.', 1);

-- ============ C1 WORDS (Advanced) ============

-- 28. ubiquitous
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'ubiquitous', v_c1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_general);
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_tech);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_adj, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'wszechobecny') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'Smartphones have become ubiquitous.', 1);

-- 29. jurisprudence
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'jurisprudence', v_c1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_law);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'orzecznictwo') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'The case set an important precedent in jurisprudence.', 1);

-- 30. deprecate
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'deprecate', v_c1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_sw_dev);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_verb, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'wycofać (z użycia)') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'We decided to deprecate the old API.', 1);

-- 31. volatility
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'volatility', v_c1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_trading);
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_finance);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'zmienność') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'Market volatility increased after the announcement.', 1);

-- 32. pedagogy
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'pedagogy', v_c1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_edu);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'pedagogika') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'Modern pedagogy focuses on student engagement.', 1);

-- 33. prognosis
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'prognosis', v_c1) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_health);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'rokowanie') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'The prognosis for recovery is positive.', 1);

-- ============ C2 WORDS (Advanced) ============

-- 34. epistemology
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'epistemology', v_c2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_edu);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'epistemologia') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'Epistemology examines the nature of knowledge.', 1);

-- 35. obfuscate
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'obfuscate', v_c2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_sw_dev);
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_general);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_verb, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'zaciemniać') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'Do not obfuscate the code unnecessarily.', 1);

-- 36. fiduciary
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'fiduciary', v_c2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_law);
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_finance);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_adj, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'powierniczy') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'A fiduciary duty requires acting in the client''s best interest.', 1);

-- 37. arbitrage
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'arbitrage', v_c2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_trading);
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_finance);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_noun, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'arbitraż') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'Arbitrage exploits price differences between markets.', 1);

-- 38. idempotent
INSERT INTO public.words (target_language_id, lemma, cefr_level_id) VALUES (v_en, 'idempotent', v_c2) RETURNING id INTO w_id;
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_sw_dev);
INSERT INTO public.word_category (word_id, category_id) VALUES (w_id, v_tech);
INSERT INTO public.sense (word_id, part_of_speech_id, sense_order) VALUES (w_id, v_adj, 1) RETURNING id INTO s_id;
INSERT INTO public.sense_translation (sense_id, native_language_id, translation) VALUES (s_id, v_pl, 'idempotentny') RETURNING id INTO st_id;
INSERT INTO public.translation_example (sense_translation_id, example_text, example_order) VALUES (st_id, 'PUT requests should be idempotent by design.', 1);

RAISE NOTICE 'Seed complete: inserted 38 words with senses, translations, examples and categories.';
END;
$$;
