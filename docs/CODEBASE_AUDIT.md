# Codebase audit & refactor plan (Wordly mobile)

Generated as part of architecture review. **Behavior-preserving** cleanups preferred.

---

## PHASE 1 — AUDIT REPORT

### Unused / likely dead files (app bundle)

| Item | Notes |
|------|--------|
| ~~`components/EditScreenInfo.tsx`~~ | Usunięte (krok 1). |
| ~~`components/StyledText.tsx`~~ | Usunięte (krok 1). |
| ~~`components/ExternalLink.tsx`~~ | Usunięte (krok 1). |

**Keep:** `src/components/Themed.tsx` — used by `app/+not-found.tsx` (przeniesione z root `components/`).

### Duplicated logic

- **Chip-style selectors** — consolidated into `src/components/ui/SelectionChip.tsx` (onboarding + settings).
- **“Centered empty state + CTA”** — wspólny `CenteredMessageCta` (`home` / `settings` / `revision` zachowują osobne style jak wcześniej).

### Large files (maintainability)

| File | ~Lines | Risk |
|------|--------|------|
| `app/(tabs)/revision.tsx` | thin route | Logic split into `src/features/revision/components/*`. |
| ~~`scripts/.../applySqlChunks.ts`~~ | — | Usunięte wraz ze starym pipeline seedów. |
| `src/services/api/vocabularyApi.ts` | ~214 | Acceptable; could split query vs mapping later. |

### Folder structure

- **Current:** `app/` (Expo Router), `src/features`, `src/services`, `src/components` (w tym `ui/` + `Themed`), `src/constants`. Root `components/` usunięty po migracji.
- **Observation:** Wspólne UI i hooki są pod `src/` — spójniejsze niż wcześniej.

### Naming

- Generally consistent (`camelCase` files, `PascalCase` components).
- Minor mix: English UI strings in some screens vs Polish in others — product decision, not a bug.

### Typing

- No widespread `: any` in TS/TSX (grep clean for `as any` / `: any`).
- `Database` w `src/types/database.ts` jest tymczasowo `any` do czasu nowego schematu i `supabase gen types`.

### Unnecessary abstractions

- **Low concern.** `kvStorage` is justified (comment explains Async Storage avoidance). Widget bridge module is justified for native targets.

### React Native / performance

- **`RevisionKnownWordsList`:** stable `keyExtractor` / `renderItem`, `memo` na wierszu, statyczny `ListEmptyComponent`, `useMemo` na nagłówku — mniej niepotrzebnych rerenderów listy.
- Image/assets: not audited in depth.

### State / navigation

- **Expo Router** stack + tabs + onboarding group — coherent.
- `AppBootstrapProvider` centralizes auth + onboarding gate — OK.

### Security (client)

- **Secrets:** `EXPO_PUBLIC_*` are expected to be public; no `service_role` in client code seen.
- **MCP / local config:** user’s `~/.cursor/mcp.json` — out of repo; `.gitignore` covers `.cursor/mcp.json` in project.

### Database / data layer (high level)

- **profiles:** `upsert` via `profileApi` with `user_id` conflict target — matches typical schema.
- **RLS:** assumed by design (migrations); client uses anon key + `auth.uid()` — standard Supabase.
- **progressApi:** `status as UserWordProgress['status']` — narrow; acceptable if DB enum matches app union.
- **vocabularyApi:** console warnings for empty levels — operational, not a schema bug.

### Suspicious / needs confirmation

- Whether **all** Google OAuth users should use **native** sign-in only (env-driven) vs browser fallback — product/env.
- **Widget extension** Swift files — not audited here (native target).

---

## PHASE 2 — PROPOSED STRUCTURE (pragmatic)

```
app/                    # Expo Router only (routes, layouts, thin screens)
src/
  features/             # feature hooks + small feature-specific UI if needed
  screens/              # optional: extract heavy screens from app/ later (re-export from app)
  components/           # shared UI (migrated from root components/ over time)
  hooks/                # cross-feature hooks
  services/
    api/                # Supabase + HTTP
    storage/            # kv, profile, onboarding
    domain/             # pure logic
  lib/                  # supabase client, env
  types/
  constants/
  theme/
  providers/
```

**Note:** Moving every file immediately is **not** required. Migrate when touching an area.

---

## PHASE 3 — REFACTOR PLAN (ordered, safe)

1. **Done in PHASE 6 step 1:** Remove dead template files (`EditScreenInfo`, `StyledText`, `ExternalLink`).
2. **Done in PHASE 6 step 2:** Shared `SelectionChip` in `src/components/ui/SelectionChip.tsx` — used by `language-pair` and `settings`.
3. **Done in PHASE 6 step 3:** Split `revision.tsx` — `RevisionFlashcardMode`, `RevisionKnownWordsList`, `RevisionWordDetailModal` + `revisionScreenStyles.ts` under `src/features/revision/`.
4. **Done in PHASE 6 step 4:** `FlatList` w `RevisionKnownWordsList` — `useCallback` / `useMemo`, `memo` na wierszu, stabilny pusty stan.
5. Add **`eslint-plugin-unused-imports`** or run knip/ts-prune in CI — **needs confirmation** (new devDependency).
6. **Done in PHASE 6 step 5:** `CenteredMessageCta` dla bloku „brak profilu / onboarding” na `home`, `settings`, `revision` (warianty stylów 1:1 z poprzednich ekranów).
7. **Database:** add migration only if schema gaps found — none identified as blocking in this audit.

---

## PHASE 4 — MOBILE BEST PRACTICES (summary)

- **Revision list:** memoized `renderItem` + row `memo` — applied (see step 4 above).
- Avoid passing **new object literals** to `tabBarStyle` every render if profiling shows churn — `tabs/_layout` is already small.
- Async: services use `async/await`; avoid floating promises in UI handlers (spot-check during splits).

---

## PHASE 5 — DATABASE / DATA LAYER (summary)

- **Naming:** snake_case in DB, camelCase in app types — mapped in API layer; consistent.
- **Validation:** profile upsert relies on TS types + Supabase; no zod on client — acceptable for MVP; **needs confirmation** if you want runtime validation.
- **Centralization:** `profileApi`, `progressApi`, `vocabularyApi` — good separation.
- **Indexes:** inferring from queries would require listing all `.eq()` / `.order()` — defer to Supabase advisor / production metrics.

---

*End of audit document.*
