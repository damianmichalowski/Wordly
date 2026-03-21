# Przed commitem na GitHub

## Sekrety

- [ ] **`git status`** — nie ma pliku `.env`, `.env.local`, ani innych `.env.*` (poza tym, że są ignorowane).
- [ ] **`git ls-files | grep env`** — opcjonalnie: upewnij się, że tylko `.env.example` jest w indeksie (jeśli go commitujesz).
- [ ] **Nigdy** nie commituj: `service_role`, hasła DB, kluczy prywatnych Apple/Google, MCP tokenów.
- [ ] Klucz **anon** Supabase w kliencie mobilnym jest „publiczny” z definicji (`EXPO_PUBLIC_*`), ale **nie wklejaj go w issue / publiczny chat** bez potrzeby — przy wycieku rozważ **rotację** w Supabase (Settings → API).

## Zależności

```bash
npm audit
```

Przy `high/critical` — zaktualizuj zależności lub uzasadnij wyjątek.

## Śmieci w repozytorium

- `node_modules/`, `.expo/`, `ios/`, `android/` — już w `.gitignore`.
- Nie commituj zrzutów ekranu z tokenami, `*.pem`, `*.p12`, profili provisioningowych.

## Historia Gita

Jeśli **kiedykolwiek** przypadkiem zcommitowałeś `.env`, samo usunięcie pliku **nie usuwa sekretów z historii** — użyj `git filter-repo` / BFG albo **unieważnij klucze** w Supabase i załóż, że projekt mógł wyciec.
