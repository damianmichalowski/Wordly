-- Tri-state: NULL = never set, true = marked difficult, false = explicitly unmarked.
alter table public.user_word_progress
  add column if not exists is_difficult boolean,
  add column if not exists difficult_marked_at timestamptz;

alter table public.user_word_progress
  alter column is_difficult drop not null,
  alter column is_difficult drop default;

-- Rows that only had the old NOT NULL default were never explicitly marked.
update public.user_word_progress
set is_difficult = null
where is_difficult = false
  and difficult_marked_at is null;

comment on column public.user_word_progress.is_difficult is
  'NULL = never set; true = user marked difficult; false = user cleared the mark.';
comment on column public.user_word_progress.difficult_marked_at is
  'Set when is_difficult becomes true; cleared when is_difficult is false or null.';
