# Migracja struktury `features` / usunięcie `modules/`

## PHASE 1 — Analiza struktury (skrót)

### Co jest w `modules/`

| Element | Opis |
|---------|------|
| **`wordly-widget-bridge/`** | Lokalny pakiet Expo (**native module**): `expo-module.config.json`, iOS Swift, Android Kotlin, `index.ts` + `.web.ts`. |

**Innych podfolderów w `modules/` brak.**

### Co jest w `src/` (już dziś)

- **`src/features/`**: `onboarding/`, `dailyWord/`, `revision/`, `settings/` (+ komponenty revision).
- **`src/services/`**, **`src/lib/`**, **`src/hooks/`**, **`src/components/`**, **`src/types/`**, itd.

### Jak routing i kod odwołują się do modułu

- **Importy w runtime:** tylko **nazwa pakietu** `wordly-widget-bridge` (nie ścieżka `modules/...`):
  - `src/services/widgets/widgetLoadingSync.ts`
  - `src/services/widgets/syncWidgetSnapshot.ts`
- **Powiązanie z dyskiem:** root `package.json` → `"wordly-widget-bridge": "file:./src/features/wordly-widget-bridge"`.
- **`app/`:** brak bezpośrednich importów z `modules/` — router nie zależy od ścieżki folderu modułu.

### Co pęknie, jeśli usuniesz `modules/` bez migracji

- `npm install` / symlink w `node_modules/wordly-widget-bridge` — **zepsute**, dopóki `file:` nie wskaże nowej lokalizacji.
- Dokumentacja (`README`, `docs/*`, `src/platform/widgets/README.md`) — odwołania do `modules/wordly-widget-bridge` do aktualizacji.

### Uwaga architektoniczna (cel użytkownika: `auth`, `vocabulary`, `learning`, …)

Obecne foldery (`dailyWord`, `revision`, `settings`) **nie** mapują 1:1 na docelową taksonomię. **Zmiana nazw folderów features** = masowa zmiana importów `@/src/features/...` — **osobna faza**, żeby nie mieszać z przenosinami native module.

### Ryzyka

- **Native / prebuild:** ścieżka `file:` jest dowolna, byle pakiet miał poprawny `expo-module.config.json`; Expo autolink używa `node_modules/wordly-widget-bridge` → symlink do lokalnego katalogu.
- **Nie ruszać** bez potrzeby: `ios/`, `targets/widget/` — tylko weryfikacja buildu po zmianie ścieżki pakietu.

---

## PHASE 2 — Plan migracji (bezpieczny)

| Krok | Działanie |
|------|-----------|
| **1** | Przenieść `modules/wordly-widget-bridge` → `src/features/wordly-widget-bridge`; zaktualizować `package.json` (`file:./src/features/wordly-widget-bridge`); `npm install`; zaktualizować docs; usunąć pusty `modules/`. |
| **2** (później) | Opcjonalnie: dodać `src/state/` jeśli pojawi się globalny store — obecnie brak wymuszenia. |
| **3** (później) | Przemianować `features/dailyWord` → `features/learning` itd. — **wymaga audytu importów**; osobny PR. |

---

## PHASE 3 — Log implementacji

- **Krok 1 (wykonany):** `wordly-widget-bridge` przeniesiony do `src/features/wordly-widget-bridge`; `package.json` + `package-lock.json`; dokumentacja (`README`, `PROJECT_STRUCTURE`, Phase 8, `platform/widgets/README`, `src/README`); katalog root `modules/` usunięty.
- **Krok 2 (wykonany, wzorzec „cienki route”):** `app/(tabs)/home.tsx` — tylko re-export; pełna implementacja w `src/features/dailyWord/screens/HomeScreen.tsx`.
- **Krok 3 (wykonany):** `app/(tabs)/settings.tsx` → `src/features/settings/screens/SettingsScreen.tsx`; `app/(tabs)/revision.tsx` → `src/features/revision/screens/RevisionScreen.tsx` (re-export w `app/`).
- **Krok 4 (wykonany):** Onboarding: `index`, `language-pair`, `level`, `summary` → `src/features/onboarding/screens/*`; `app/(onboarding)/_layout.tsx` bez zmian.
- **Krok 5 (wykonany):** Trasy globalne: `app/index.tsx` → `src/screens/RootIndexScreen`; `app/(tabs)/index.tsx` → `TabsIndexRedirectScreen`; `app/+not-found.tsx` → `NotFoundScreen`.
- **Później:** `RootIndexScreen` / `TabsIndexRedirect` / `NotFound` — scalone w pliki `app/*` (bez `src/screens/`).
