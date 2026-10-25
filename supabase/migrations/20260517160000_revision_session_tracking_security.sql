-- =========================================================
-- SECURITY HOTFIX: Enable RLS and revoke direct table access
-- for revision session tracking tables.
--
-- These tables are accessed ONLY through SECURITY DEFINER RPCs:
--   start_revision_session, complete_revision_session,
--   get_revision_dashboard_stats.
-- Direct client-side table access is intentionally denied.
-- =========================================================

-- Enable RLS (without FORCE, so SECURITY DEFINER RPCs still work as table owner).
alter table public.user_revision_session enable row level security;
alter table public.user_revision_answer enable row level security;

-- Revoke all direct table privileges from anon and authenticated roles.
revoke all on table public.user_revision_session from anon, authenticated;
revoke all on table public.user_revision_answer from anon, authenticated;

comment on table public.user_revision_session is
  'Per-session aggregate for revision tracking. Access via SECURITY DEFINER RPCs only.';
comment on table public.user_revision_answer is
  'Per-word answer within a revision session. Access via SECURITY DEFINER RPCs only.';
