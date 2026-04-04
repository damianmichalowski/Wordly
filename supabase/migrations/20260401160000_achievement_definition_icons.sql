-- Per-achievement Ionicons names (Ionicons 5 / Expo vector-icons) for list cards and clients.

update public.achievement_definition
set icon = 'book-outline'
where code = 'known_words_10';

update public.achievement_definition
set icon = 'document-text-outline'
where code = 'known_words_20';

update public.achievement_definition
set icon = 'school-outline'
where code = 'known_words_30';

update public.achievement_definition
set icon = 'library-outline'
where code = 'known_words_50';

update public.achievement_definition
set icon = 'bar-chart-outline'
where code = 'known_words_100';

update public.achievement_definition
set icon = 'trending-up'
where code = 'known_words_200';

update public.achievement_definition
set icon = 'layers-outline'
where code = 'known_words_300';

update public.achievement_definition
set icon = 'rocket-outline'
where code = 'known_words_500';

update public.achievement_definition
set icon = 'planet-outline'
where code = 'known_words_800';

update public.achievement_definition
set icon = 'star'
where code = 'known_words_1000';

update public.achievement_definition
set icon = 'sparkles'
where code = 'known_words_1200';

update public.achievement_definition
set icon = 'compass-outline'
where code = 'known_words_2000';

update public.achievement_definition
set icon = 'trophy'
where code = 'known_words_3000';

update public.achievement_definition
set icon = 'flame'
where code = 'streak_3';

update public.achievement_definition
set icon = 'flash'
where code = 'streak_7';

update public.achievement_definition
set icon = 'calendar-outline'
where code = 'streak_14';

update public.achievement_definition
set icon = 'sunny-outline'
where code = 'streak_30';

update public.achievement_definition
set icon = 'medal-outline'
where code = 'streak_60';

update public.achievement_definition
set icon = 'ribbon'
where code = 'streak_100';

update public.achievement_definition
set icon = 'star'
where code = 'streak_180';

update public.achievement_definition
set icon = 'trophy'
where code = 'streak_365';
