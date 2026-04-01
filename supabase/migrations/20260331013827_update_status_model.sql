-- =========================
-- update status model: remove 'review'
-- =========================

-- 1. usuń constraint
alter table public.user_word_progress
drop constraint if exists user_word_progress_status_check;

-- 2. ustaw nowy constraint (tylko learning + known)
alter table public.user_word_progress
add constraint user_word_progress_status_check
check (status in ('learning', 'known'));

-- =========================
-- opcjonalnie: wyczyść stare dane jeśli jakieś były
-- =========================

-- jeśli masz stare dane z 'review'
update public.user_word_progress
set status = 'known'
where status = 'review';