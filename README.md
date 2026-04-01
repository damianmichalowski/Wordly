# Wordly

Expo + React Native mobile app for daily vocabulary learning.

## Run

```bash
npm install
```

**Lint (ESLint + Expo config):**

```bash
npm run lint
```

**Expo Go** (JS only, no iOS home widget):

```bash
npm run start
```

**Development build** (wymagany do **widgetu iOS** + lokalnego modułu `wordly-widget-bridge`):

```bash
npm run ios:prebuild
cd ios && LANG=en_US.UTF-8 pod install && cd ..
npx expo run:ios
npm run start:dev
```

`ios:prebuild` = `expo prebuild --platform ios --clean` (bez `--clean` drugi prebuild z widgetem może wywalić `@bacons/apple-targets` — zob. **`docs/PREBUILD_APPLE_TARGETS.md`**).

(`start:dev` = Metro z `expo-dev-client`.)

Copy `.env.example` to `.env` and set Supabase keys when using cloud sync. Opcjonalnie **`APPLE_TEAM_ID`** (10 znaków) — wczytuje `app.config.ts`, usuwa warning pluginu i ustawia team.

### iOS widget (Phase 8)

- Kod widgetu: `targets/widget/` (`@bacons/apple-targets`) — mały / średni (Known·Skip) / Lock Screen.
- Most JS → App Group: `src/features/wordly-widget-bridge` (`setSnapshotJson` + `WidgetCenter.reloadTimelines`).
- Deep linki z widgetu: `useWidgetDeepLinkActions` (`action=known|skip`).
- Team ID: **`APPLE_TEAM_ID` w `.env`** albo ręcznie w Xcode (Signing).

### iPhone (real device)

Primary testing target is **physical iPhone**. See **[`docs/IOS_DEVICE.md`](./docs/IOS_DEVICE.md)** — prebuild, signing, `npm run ios:device`, Metro + Wi‑Fi.

- Default **bundle ID**: `com.wordly.mobile` (change before App Store release).

## Docs

| Doc | Content |
|-----|---------|
| [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md) | **Struktura repo** — `app/` vs `src/`, migracje, importy |
| [`docs/FEATURE_STRUCTURE_MIGRATION.md`](./docs/FEATURE_STRUCTURE_MIGRATION.md) | **Migracja `modules/` → `src/features/`** (native bridge) |
| [`src/README.md`](./src/README.md) | App architecture (domain, features, services) |
| [`src/platform/widgets/README.md`](./src/platform/widgets/README.md) | Widget-facing JS contracts (Phase 7) |
| [`docs/PHASE_8_NATIVE_WIDGETS.md`](./docs/PHASE_8_NATIVE_WIDGETS.md) | **Native widgets** — dev builds, iOS/Android, data bridge |
| [`docs/PREBUILD_APPLE_TARGETS.md`](./docs/PREBUILD_APPLE_TARGETS.md) | **Prebuild + widget** — `removeFromProject` / `--clean`, `APPLE_TEAM_ID` |
| [`docs/IOS_DEVICE.md`](./docs/IOS_DEVICE.md) | **iPhone real device** — prebuild, signing, Metro |

## Phases completed in code

- Onboarding, daily word, revision, settings, audio (TTS)
- Widget **contracts** + deep links + `stateVersion` (JS)
- **Phase 8 (iOS):** home screen widget (`WordlyDailyWidget`) + App Group snapshot + dev client — szczegóły w `docs/PHASE_8_NATIVE_WIDGETS.md`
