create or replace function public.complete_daily_review_session(
  p_user_id uuid,
  p_word_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_updated_count int;
begin
  if p_word_ids is null or array_length(p_word_ids, 1) is null then
    return jsonb_build_object(
      'success', true,
      'updatedCount', 0
    );
  end if;

  update public.user_word_progress uwp
  set
    last_review_at = v_now,
    interval_days = case
      when coalesce(uwp.interval_days, 1) <= 1 then 3
      when uwp.interval_days = 3 then 7
      when uwp.interval_days = 7 then 14
      when uwp.interval_days = 14 then 30
      else 30
    end,
    next_review_at = v_now + (
      case
        when coalesce(uwp.interval_days, 1) <= 1 then interval '3 days'
        when uwp.interval_days = 3 then interval '7 days'
        when uwp.interval_days = 7 then interval '14 days'
        when uwp.interval_days = 14 then interval '30 days'
        else interval '30 days'
      end
    ),
    updated_at = v_now
  where uwp.user_id = p_user_id
    and uwp.status = 'known'
    and uwp.word_id = any(p_word_ids);

  get diagnostics v_updated_count = row_count;

  return jsonb_build_object(
    'success', true,
    'updatedCount', v_updated_count
  );
end;
$$;