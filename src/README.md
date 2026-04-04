# Wordly — kod aplikacji (`src/`)

Warstwa produktowa i infrastruktura **niezależna od routingu** (Expo Router żyje w `../app/`).

Pełniejszy opis folderów repo (w tym `app/`, `modules/`, `supabase/`) → **[`../docs/PROJECT_STRUCTURE.md`](../docs/PROJECT_STRUCTURE.md)**.  
Warstwa stanu ekranów / async (viewKind, brama profilu, Hub vs Library) → **[`../docs/SCREEN_STATE_ARCHITECTURE.md`](../docs/SCREEN_STATE_ARCHITECTURE.md)**.

## Struktura (aktualna)

| Folder | Rola |
|--------|------|
| **`components/`** | Wspólne UI: `Themed.tsx`, `components/ui/*` (np. `SelectionChip`, `CenteredMessageCta`) |
| **`constants/`** | Stałe aplikacji (`Colors`, języki, klucze storage) |
| **`domain/`** | Logika czysta (np. mapowanie poziomów, reguły wyboru) |
| **`events/`** | Nazwy / kontrakty zdarzeń między modułami |
| **`features/`** | Moduły „od ekranu” + `screens/*` (np. `daily-word/`, `revision/`, `library/`, `settings/`); native **`wordly-widget-bridge`** (`file:` w root `package.json`) |
| **`hooks/`** | Hooki wielokrotnego użytku (`useAppBootstrap`, motyw, widget sync, …) |
| **`lib/`** | Klienci zewnętrzni (Supabase, env) |
| **`providers/`** | Konteksty React (np. bootstrap) |
| **`services/`** | API, storage, audio, auth, widgety |
| **`theme/`** | Tokeny wizualne (Stitch) |
| **`types/`** | Typy domeny i DTO |
| **`utils/`** | Funkcje pomocnicze bez stanu UI |

## Importy

- Preferuj **`@/src/...`** dla modułów z tego drzewa (alias `@/*` → root repo w `tsconfig.json`).
- Pliki w `app/` importują ekrany/logikę z `@/src/...` — nie kopiuj logiki biznesowej do `app/`.

## Legacy / platforma

- **`platform/widgets/`** — kontrakty JS pod widget (snapshot, deep linki) — zob. [`platform/widgets/README.md`](./platform/widgets/README.md).
