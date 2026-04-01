-- Po zmianie trybu nauki (difficulty/category/język) get_or_create_daily_word zwracałby
-- stary word_id z user_daily_word na dziś — usuwamy przypisanie na dziś; kolejne
-- get_or_create_daily_word wylosuje słowo wg aktualnego profilu (jak w innych migracjach: current_date).

create or replace function public.invalidate_today_daily_word()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.user_daily_word
  where user_id = v_user_id
    and day_date = current_date;
end;
$$;

revoke all on function public.invalidate_today_daily_word() from public;
grant execute on function public.invalidate_today_daily_word() to authenticated;
