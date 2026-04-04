# Wordly — Agent Instructions

## Cursor Cloud specific instructions

### Overview

Wordly is an Expo + React Native (SDK 55) mobile app for daily vocabulary learning. It uses **Supabase** as the backend (PostgreSQL, Auth, Realtime). The lockfile is `package-lock.json` — use **npm** as the package manager. The `postinstall` script runs `patch-package` automatically.

### Running services

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Metro bundler (Expo) | `npx expo start --web --port 8081` | 8081 | Web target has a pre-existing `PlatformColor` error; this is expected since the app targets iOS/Android primarily. |
| Supabase (local) | `npx supabase start` | 54321 (API), 54322 (DB), 54323 (Studio) | Requires Docker. First run pulls ~2 GB of images. Use `npx supabase db reset` to apply migrations + seeds. |

### Environment variables

Copy `.env.example` to `.env`. For local Supabase, get keys from `npx supabase status -o env`:
- `EXPO_PUBLIC_SUPABASE_URL` → `API_URL` value (e.g. `http://127.0.0.1:54321`)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` → `ANON_KEY` value

### Docker in Cloud VM (nested containers)

Docker must be configured for nested containers. After installing Docker:
1. Set `fuse-overlayfs` as the storage driver in `/etc/docker/daemon.json`
2. Switch iptables to legacy: `sudo update-alternatives --set iptables /usr/sbin/iptables-legacy`
3. Start dockerd: `sudo dockerd &>/tmp/dockerd.log &`
4. Fix socket permissions: `sudo chmod 666 /var/run/docker.sock`

### Lint / Type-check

- **Lint**: `npm run lint` (ESLint + Expo config). Passes with warnings only (no errors).
- **TypeScript**: `npx tsc --noEmit`. Pre-existing type errors exist due to Supabase-generated types not covering newer RPC functions. These are not blockers for development or runtime.

### Key caveats

- The web target (`npm run web` or `npx expo start --web`) has a known `PlatformColor is not a function` error in `TrackProgressPill.tsx`. The app is designed primarily for iOS/Android.
- Supabase's `seed.sql` is referenced in `config.toml` but does not exist in the repo — the `WARN: no files matched pattern: supabase/seed.sql` message during `supabase db reset` is expected. All seed data is applied via migrations.
- No automated test suite (unit/integration) is configured in the repo. Testing is manual via device/simulator.
