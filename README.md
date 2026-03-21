# Wordly (mobile)

Expo + React Native app for daily vocabulary learning.

## Run

```bash
npm install
npm run start
```

Copy `.env.example` to `.env` and set Supabase keys when using cloud sync.

### iPhone (real device)

Primary testing target is **physical iPhone**. See **[`docs/IOS_DEVICE.md`](./docs/IOS_DEVICE.md)** — prebuild, signing, `npm run ios:device`, Metro + Wi‑Fi.

- Default **bundle ID**: `com.wordly.mobile` (change before App Store release).

## Docs

| Doc | Content |
|-----|---------|
| [`src/README.md`](./src/README.md) | App architecture (domain, features, services) |
| [`src/platform/widgets/README.md`](./src/platform/widgets/README.md) | Widget-facing JS contracts (Phase 7) |
| [`docs/PHASE_8_NATIVE_WIDGETS.md`](./docs/PHASE_8_NATIVE_WIDGETS.md) | **Native widgets plan** — dev builds, iOS/Android, data bridge |
| [`docs/IOS_DEVICE.md`](./docs/IOS_DEVICE.md) | **iPhone real device** — prebuild, signing, Metro |
| [`docs/VOCABULARY_DATA.md`](./docs/VOCABULARY_DATA.md) | **Skąd brać słowa** — CEFR, Oxford, licencje, import do Supabase |

## Phases completed in code

- Onboarding, daily word, revision, settings, audio (TTS)
- Widget **contracts** + deep links + `stateVersion` (JS)
- **Native widget UI** = Phase 8 — see `docs/PHASE_8_NATIVE_WIDGETS.md`
