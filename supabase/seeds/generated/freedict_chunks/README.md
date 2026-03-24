# Import FreeDict przez SQL Editor (Supabase)

Plik `wordly_freedict_full.sql` jest za duży na jedno zapytanie. Tu są **mniejsze części** (`part001` …).

## Kolejność

1. **`wordly_freedict_full.part001.sql`** → potem **002**, **003**, … aż do ostatniego pliku.
2. W każdym pliku jest `begin;` … `commit;` — wklej **cały** plik i kliknij **Run**.
3. **Nie zmieniaj kolejności** — najpierw wszystkie batche z `vocabulary_lemmas`, potem `vocabulary_senses` (tak są ponumerowane).

## Regeneracja

Z katalogu głównego repozytorium:

```bash
npm run vocabulary:seed:split-sql -- \
  --in supabase/seeds/generated/wordly_freedict_full.sql \
  --out-dir supabase/seeds/generated/freedict_chunks \
  --chunk 500
```

Mniejszy `--chunk` (np. 300) = więcej plików, ale bezpieczniej przy bardzo niskim limicie edytora.

## Bez przeklejania — jedna komenda (Node + `pg`)

Potrzebujesz **connection stringa** do bazy (jak do `psql`), **nie** wklejaj go do gita.

```bash
# w katalogu głównym repozytorium
npm install   # pierwszy raz po dodaniu skryptu

export DATABASE_URL="postgresql://postgres:HASŁO@db.TWOJ_REF.supabase.co:5432/postgres?sslmode=require"

npm run vocabulary:seed:apply-chunks
```

Skrypt wykona po kolei wszystkie `wordly_freedict_full.partXXX.sql` z tego katalogu (sort **numeryczny**). Hasło tylko w terminalu / zmiennej środowiskowej.

### `ECONNREFUSED` / IPv6

Skrypt ustawia **preferencję IPv4** (`ipv4first`). Jeśli nadal błąd:

1. W Supabase **Settings → Database** skopiuj **Session pooler** (host `….pooler.supabase.com`, user `postgres.<ref>`, port jak w panelu — często **5432**) i użyj go jako `DATABASE_URL` (+ `?sslmode=require`).
2. Albo w **Settings → Database** włącz dostęp z Twojego IP / wyłącz „restrict connections” jeśli masz taką opcję.
