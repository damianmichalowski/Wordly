-- =========================
-- seed: language
-- =========================

insert into public.language (code, name)
values
  ('en', 'English'),
  ('pl', 'Polish'),
  ('de', 'German'),
  ('es', 'Spanish'),
  ('it', 'Italian'),
  ('hi', 'Hindi'),
  ('pt', 'Portuguese'),
  ('tr', 'Turkish')
on conflict (code) do update
set
  name = excluded.name;

-- =========================
-- seed: cefr_level
-- =========================

insert into public.cefr_level (code, order_index)
values
  ('A1', 1),
  ('A2', 2),
  ('B1', 3),
  ('B2', 4),
  ('C1', 5),
  ('C2', 6)
on conflict (code) do update
set
  order_index = excluded.order_index;

-- =========================
-- seed: part_of_speech
-- =========================

insert into public.part_of_speech (code, name, order_index)
values
  ('noun', 'Noun', 1),
  ('verb', 'Verb', 2),
  ('adjective', 'Adjective', 3),
  ('adverb', 'Adverb', 4),
  ('phrase', 'Phrase', 5),
  ('other', 'Other', 6)
on conflict (code) do update
set
  name = excluded.name,
  order_index = excluded.order_index;

-- =========================
-- seed: category
-- =========================

insert into public.category (code, name, description)
values
  ('general', 'General', 'General everyday vocabulary'),
  ('business', 'Business', 'Business and workplace vocabulary'),
  ('travel', 'Travel', 'Travel and transport vocabulary'),
  ('technology', 'Technology', 'Technology and software vocabulary'),
  ('health', 'Health', 'Health and medical vocabulary'),
  ('education', 'Education', 'Education and learning vocabulary'),
  ('law', 'Law', 'Legal vocabulary'),
  ('finance', 'Finance', 'Finance and money vocabulary'),
  ('software_development', 'Software Development', 'Vocabulary for programmers and software engineers'),
  ('trading', 'Trading', 'Trading, markets and investing vocabulary')
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description;