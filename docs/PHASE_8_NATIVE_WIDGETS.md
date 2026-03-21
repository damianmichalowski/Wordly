# Phase 8 — Native widgets & external surfaces (plan)

This document is the implementation roadmap for **real** home-screen and lock-screen surfaces. It assumes Phases 0–7 are done: shared domain, `widgetSurfaceService`, deep links, and `stateVersion` sync are defined in JS.

**Expo Go is not sufficient** for shipping widgets. You need **development builds** (`expo run:ios` / `expo run:android` or EAS Build) and **custom native targets** (widget extensions).

---

## 1. Goals

| Platform | Surface | MVP | Later |
|----------|---------|-----|--------|
| **iOS** | Home Screen Widget (WidgetKit) | Read-only + tap → app | Buttons (Known/Skip) via App Intents |
| **iOS** | Lock Screen / Live Activity | Privacy-first copy | Same |
| **Android** | App Widget | Read-only + tap → app | Buttons + `Glance` / `RemoteViews` |
| **Android** | Lock screen | OS-dependent; often notification / ongoing | Same |

**Non-goals in Phase 8:** reimplementing daily-word selection in Swift/Kotlin. Native code should **display** and **trigger actions** that ultimately match `getWidgetSurfaceSnapshot` / `applyWidgetAction` semantics.

---

## 2. Why leave the managed JS app

- Widgets live in **separate processes** and **separate bundles** from React Native.
- `AsyncStorage` / in-app JS state is **not** visible to the widget unless you **copy** it to a shared store or **fetch** from the backend.

So Phase 8 adds a **data bridge** (pick one primary strategy; you can combine later).

---

## 3. Recommended data strategies

### A. Backend as source of truth (best for multi-device)

- App writes progress + `daily_word_state` to **Supabase** (already planned).
- Widget uses a **lightweight read** (anon key + RLS, or a narrow Edge Function) for `active_word_id`, `state_version`, minimal text fields.
- **Pros:** Consistent across devices; widgets always “phone home.”
- **Cons:** Network dependency; auth/session for user-specific rows must be designed (e.g. refresh token in Keychain / encrypted shared prefs — native work).

### B. App Group (iOS) + SharedPreferences set (Android) — offline-first

- On each daily-word update, the RN app writes a **JSON snapshot** (same shape as `WidgetSurfaceSnapshot`) to:
  - **iOS:** App Group `UserDefaults`
  - **Android:** `SharedPreferences` in a **shared** package name or `FileProvider` + same-user space (exact pattern depends on widget provider setup)
- Widget extension **only reads** this blob and renders UI.
- **Pros:** Fast; works offline after last sync from app.
- **Cons:** Stale until app opens; must bump `stateVersion` when app updates state.

### C. Hybrid (recommended product path)

- **B** for instant display when offline.
- **A** for reconciliation and “true” sync when network exists (optional background fetch in app).

The JS contracts in `src/services/widgets/` stay the **schema** for whatever you serialize to disk or send to the API.

---

## 4. Expo / React Native project shape

1. **Development build**
   - `npx expo install expo-dev-client` (when you start native work).
   - `eas build` or local `expo run:ios` / `expo run:android` after `expo prebuild` (or use **CNG** with `app.json` / plugins).

2. **Prebuild**
   - `npx expo prebuild` generates `ios/` and `android/` for adding native targets manually or via **config plugins**.

3. **Config plugins** (later)
   - Custom plugin or community plugin to:
     - Register App Group identifier (iOS).
     - Add Widget Extension target (often **manual** in Xcode first, then codify).
     - Wire Android `AppWidgetProvider` in `AndroidManifest.xml`.

Expo documents **development builds** and **custom native code**; widgets are a standard “custom native” case.

---

## 5. iOS — concrete native work

| Task | Notes |
|------|--------|
| Widget Extension target | Swift, WidgetKit `TimelineProvider` |
| App Groups | Same group ID for app + extension; share `UserDefaults(suiteName:)` |
| Deep link | Already `wordly://` in `app.json`; confirm **Associated Domains** if you add universal links later |
| Tap | `widgetURL` / `Link` in widget → opens `wordly://home?...` |
| Buttons (Known/Skip) | **App Intents** or **SiriKit**-style intents that call into extension handler → must invoke shared code or open app with query params; full idempotency should mirror `applyWidgetAction` + `expectedStateVersion` |
| Lock screen | WidgetKit compact/medium; Live Activity = separate ActivityKit setup |
| Privacy | Do not put `targetText` on lock screen if user opts out — align with `revealTranslation` flag |

**Swift should not** duplicate selection logic: pass `wordId`, `stateVersion`, and display strings from shared JSON written by the app or fetched from API.

---

## 6. Android — concrete native work

| Task | Notes |
|------|--------|
| `AppWidgetProvider` | Update widget `RemoteViews` or **Glance** for AppWidget |
| Shared data | `SharedPreferences` with `MODE_PRIVATE` in app; widget reads via same signature if same UID, or explicit `FileProvider` / content provider for cross-process |
| Tap | `PendingIntent` with deep link URI `wordly://home?...` |
| Buttons | `PendingIntent` + broadcast or activity; action must match `applyWidgetAction` semantics |
| Refresh | `WorkManager` or alarm to periodic refresh; OS may throttle |
| Lock screen | Often **notification** with expanded text; not 1:1 with iOS widgets |

---

## 7. Bridge from React Native → native (implementation order)

1. **Native module** (or small Expo module) `WordlyWidgetBridge`:
   - Method: `setSnapshot(json: string)` — called from JS after `getWidgetSurfaceSnapshot()` or on app foreground.
   - iOS: write to App Group `UserDefaults`.
   - Android: write to `SharedPreferences` / file the widget reads.

2. **Call sites in JS** (future PR, not blocking domain work):
   - After `applyDailyWordAction`, after settings save, after onboarding — refresh snapshot and push to native.

3. **Widget reload**
   - iOS: `WidgetCenter.shared.reloadTimelines(ofKind:)`.
   - Android: `AppWidgetManager` + `ACTION_APPWIDGET_UPDATE`.

---

## 8. Checklist before writing Swift/Kotlin UI

- [ ] `WidgetSurfaceSnapshot` JSON shape is stable (version field in JSON if schema evolves).
- [ ] `stateVersion` increments on every meaningful transition (already in `dailyWordService`).
- [ ] Deep link query params documented (`src/services/widgets/deepLinks.ts`).
- [ ] Supabase RLS allows only the signed-in user to read/write their rows (when using strategy A).
- [ ] Privacy setting for “hide translation on lock screen” exists or is stubbed in profile.

---

## 9. Suggested repo layout after prebuild

```
wordly-mobile/
  app/                    # Expo Router (unchanged)
  src/
    services/widgets/     # JS contracts (done)
    platform/
      ios/                # optional: notes, Swift snippets, not full Xcode project
      android/            # optional: same
  docs/
    PHASE_8_NATIVE_WIDGETS.md   # this file
  ios/                    # after prebuild — gitignored or committed per team policy
  android/
```

---

## 10. Next implementation PR (when you start native)

1. Add `expo-dev-client` + first **local** `expo prebuild`.
2. Manually add Widget Extension in Xcode; prove **read** from App Group filled by a hardcoded JSON.
3. Add RN native module to write JSON from `getWidgetSurfaceSnapshot()`.
4. Repeat analogous path on Android.
5. Then: buttons + `expectedStateVersion` in intent/broadcast handlers.

---

## References (Expo)

- Development builds: use **EAS Build** or `expo run:*` with dev client — not Expo Go for custom native code.
- Config plugins: extend `app.json` `plugins` array when automating App Groups / manifest entries.

This keeps **Wordly**’s product rule: **one domain**, **many surfaces** — native code is a thin, replaceable shell around the same contracts.
