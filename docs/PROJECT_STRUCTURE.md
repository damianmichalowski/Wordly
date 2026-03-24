# Project structure — audit & migration (Wordly)

Expo Router + React Native + TypeScript. **Living document:** update as migrations complete.

---

## PHASE 1 — Structure audit

### 1. Current structure (assessment)

| Area | Role today | Verdict |
|------|------------|--------|
| **`app/`** | Expo Router: layouts, route groups `(tabs)`, `(onboarding)`, entry `index`, HTML | **Correct** — keep routes here; screens are thin and delegate to `src/features`. |
| **`src/`** | Features, services, `lib/supabase`, types, theme, hooks, shared `components/ui` | **Correct** — main application logic. |
| **`components/` (root)** | ~~Removed~~ — zostało przeniesione do `src/hooks/` i `src/components/Themed.tsx`. | **Resolved** (migracja struktury). |
| **`src/features/wordly-widget-bridge`** | Expo native module (TS + Kotlin/Swift) — lokalny pakiet `file:` w `package.json` | **Correct** |
| **`targets/widget/`** | `@bacons/apple-targets` iOS widget extension | **Correct** — must stay; tooling expects this path. |
| **`supabase/`** | Migrations, seeds, README | **Correct** — backend schema lives with app repo. |
| **`scripts/vocabulary-seed/`** | Offline seed tooling (tsx) | **Correct** — not bundled with the app. |
| **`patches/`** | `patch-package` | **Correct** — root is conventional. |
| **`ios/`** | Prebuild / Xcode project | **Risky** — don’t reorganize without strong reason. |
| **`docs/`** | Architecture, flows, checklists | **Good** — consolidated documentation. |

### 2. What feels wrong

- **Two “constants” homes:** root `constants/` (removed in migration step 1) vs `src/constants/` — duplicated mental model.
- ~~**Two “components” homes**~~ — po migracji: `src/components/` (`Themed`, `ui/*`).
- **Mixed language in UI strings** (EN vs PL) — product/i18n, not folder structure.
- **`@/*` → repo root** — convenient but allows imports from both `app/` and `src/` with similar-looking paths (`@/components` vs `@/src/components`).

### 3. Folders with unclear purpose (before cleanup)

- **`constants/`** at root — only held `Colors.ts` tied to Stitch; better next to `languages.ts` / `storageKeys.ts`.

### 4. Overlapping responsibilities

- **Tab theming:** `Colors` (light/dark tint) + `StitchColors` in layouts — intentional layering; document, don’t merge blindly.
- **“Shared UI”:** `Themed` + `src/components/ui/*` — jeden katalog `src/components` (ew. później podfolder `legacy/` tylko jeśli potrzeba).

### 5. Likely future moves (not all done yet)

| Item | Suggestion |
|------|------------|
| ~~`components/Theme*.ts` hooks~~ | → `src/hooks/` (**done**) |
| ~~`components/Themed.tsx`~~ | → `src/components/Themed.tsx` (**done**) |
| Screen files | Implementacja w `src/features/*/screens/*`; trasy w `app/` importują ekran (bez osobnego `src/screens/`) |

### 6. Should stay at repo root

- `app/`, `app.json`, `app.config.ts`, `package.json`, `tsconfig.json`, `expo-env.d.ts`
- `targets/`, `patches/`, `supabase/`, `scripts/`, `docs/`, `ios/` (if committed)
- `.env.example`, `.gitignore`

### 7. Risky / do not touch blindly

- **`app/` route tree** — file names and groups = URLs.
- **`ios/`, `targets/widget/`**, lokalne pakiety z `file:` pod **`src/features/*/android|ios`** — native wiring, Xcode, Gradle.
- **`app.config.ts` / plugins** — env and native plugins.
- **`supabase/migrations`** — ordering and history.
- **`patches/`** — must match `node_modules` paths.

---

## PHASE 2 — Target structure (practical)

```
app/                          # Expo Router only
src/
  components/
    ui/                       # shared presentational (SelectionChip, CenteredMessageCta, …)
  constants/                  # app constants (Colors, languages, storage keys)
  domain/                     # pure rules
  features/                   # feature hooks + local native pkg `wordly-widget-bridge` (file:)
  (route-only logic)          # /, (tabs) index, +not-found: bezpośrednio w plikach `app/*`
  hooks/                      # cross-cutting hooks
  lib/                        # supabase client, env helpers
  providers/
  services/                   # api, storage, audio, widgets, auth
  theme/
  types/
  utils/
  events/                     # cross-feature event names (optional; or under services)
components/                   # (removed) — było `Themed` + hooks; teraz `src/components` + `src/hooks`
targets/                      # Apple widget extension (bacons)
supabase/                     # migrations + seeds
scripts/                      # tooling (vocabulary-seed, …)
patches/
docs/
ios/ android/                 # when using prebuild / committed native projects
```

**Supabase:** keep `src/lib/supabase/` for client; keep `supabase/` at root for SQL migrations.

### Import conventions (team)

- Kod aplikacji z `src/`: importuj jako **`@/src/...`** (np. `@/src/features/dailyWord/useDailyWord`).
- `app/` — pliki routingu Expo Router; **implementacja UI** w `src/features/<feature>/screens/*`; w pliku trasy: `import …Screen` + `export default` (np. `app/(tabs)/home.tsx` → `HomeScreen.tsx`). Trasy wyłącznie przekierowujące / 404: logika w `app/index.tsx`, `app/(tabs)/index.tsx`, `app/+not-found.tsx`.
- Unikaj nowych plików w root poza `app/`, `src/`, `targets/`, konfiguracją i `docs/`.

---

## PHASE 3 — Migration plan

| Step | Action | Risk | Status |
|------|--------|------|--------|
| **1** | Move `constants/Colors.ts` → `src/constants/Colors.ts`; update imports; remove empty `constants/` | **Low** (2 importers) | **Done** |
| **2** | ESLint: `eslint` + `eslint-config-expo`, `npm run lint` (`expo lint`), `eslint.config.js` | Low–medium | **Done** |
| **3** | Move `components/useColorScheme*` + `useClientOnlyValue*` → `src/hooks/`; update imports in `app/_layout`, `app/(tabs)/_layout`, `components/Themed` | Medium | **Done** |
| **4** | Move `Themed.tsx` → `src/components/Themed.tsx`; update `app/+not-found.tsx`; remove root `components/` | Low–medium | **Done** |
| **5** | Doc hygiene: `src/README.md` + `README.md` link do tego dokumentu | None | **Done** |
| **6** | Consider `src/app-shared/` alias only if `@/` confusion persists — **not required** | Low | Optional |

**Safe order:** constants → hooks → small UI → never batch native or router moves.

---

## PHASE 4 — Implementation log

- **Step 1 (2026):** `Colors` consolidated under `src/constants/Colors.ts`; imports in `app/(tabs)/_layout.tsx`, `components/Themed.tsx`; root `constants/` removed.
- **Step 3 (2026):** `useColorScheme` / `useClientOnlyValue` (+ `.web` variants) moved to `src/hooks/`; `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `Themed.tsx` (wtedy w `components/`) updated; stare pliki w root `components/` usunięte.
- **Step 4 (2026):** `Themed.tsx` → `src/components/Themed.tsx`; `app/+not-found.tsx` import z `@/src/components/Themed`; katalog root `components/` usunięty (pusty).
- **Step 5 (2026):** Zaktualizowano **`src/README.md`** (struktura + konwencja `@/src/...`); **`README.md`** linkuje `docs/PROJECT_STRUCTURE.md` (higiena dokumentacji po migracji).
- **Step 2 (ESLint, 2026):** `eslint` + `eslint-config-expo`, skrypt **`npm run lint`**, `eslint.config.js` (flat); ignorowane m.in. `ios/`, `scripts/vocabulary-seed/`, `supabase/`; poprawka `react/no-unescaped-entities` w `app/+not-found.tsx`.
