/**
 * Meaningful user intent logging for dev builds. Call synchronously at the start of
 * press handlers so logs appear before async RPC / fetch work (and `[wordly][rpc]` logs).
 *
 * Typical `action` values: `button_press`, `tab_press`, `tile_press`, `segment_change`,
 * `filters_apply`, `filters_change`, `session_start`.
 *
 * **Revision sessions:** `revision_hub_open_session_intro` / `revision_hub_quick_size` /
 * `revision_hub_session_intro_sheet_close` capture sheet UX. `session_start` fires once
 * when `enterSession` runs in the Revision Hub tab (fetch + flashcards), with `from=revision_hub`
 * — not a duplicate of opening the intro sheet. (Library browse does not start this session flow.)
 *
 * `target` is a stable string id (often prefixed by area: `settings_`, `daily_word_`,
 * `revision_`, `library_`, `onboarding_`, `word_details_`, `achievement_`, `filters_`).
 * Optional payload fields (e.g. `reason`, `mode`, `wordId`) add context without log spam.
 */
export function logUserAction(
  action: string,
  payload?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!__DEV__) {
    return;
  }
  const parts = [`[USER_ACTION] action=${action}`];
  if (payload) {
    for (const [k, v] of Object.entries(payload)) {
      if (v === undefined) continue;
      parts.push(`${k}=${String(v)}`);
    }
  }
  console.log(parts.join(" "));
}
