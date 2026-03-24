# Przepływ aplikacji Wordly (MVP → skalowanie)

## Stan obecny (routing)

1. **Start (`/`)** — `AppBootstrapProvider` ładuje flagę onboardingu + sesję Supabase.
2. **Brak ukończonego onboardingu** albo **brak sesji przy skonfigurowanym Supabase** → `/(onboarding)` (logowanie Google / Apple).
3. **Po zalogowaniu** (nowy użytkownik) → kolejno: para języków → poziom → podsumowanie → zapis profilu → `/(tabs)/home`.
4. **Po zalogowaniu** (użytkownik już po onboardingu) → od razu `/(tabs)/home` (synchronizacja `userId` w profilu lokalnym).
5. **Główny ekran** — słowo dnia (`useDailyWord` + Supabase).

## Planowane rozszerzenia (bez implementacji)

| Krok | Opis |
|------|------|
| Ekran powitalny | Krótki opis aplikacji + przycisk „Zaczynajmy” przed logowaniem (osobny route lub warunek w stacku). |
| Instrukcja widgetu | Na `home` lub modal: jak dodać widget iOS na ekran główny (link do Ustawień / krótki film). |

## Logowanie Google (Safari / localhost)

Ostatnie przekierowanie po stronie **Supabase** musi trafić w **`wordly://auth/callback`** (dokładnie ten string w **Redirect URLs**). Inaczej Supabase używa **Site URL** (często `http://localhost:3000`) — na telefonie Safari pokazuje błąd połączenia i sesja nie wraca do aplikacji.

Szczegóły: [SOCIAL_AUTH.md](./SOCIAL_AUTH.md).

## Słowo dnia — kiedy może być puste

- **Brak sesji** lub profilu zdalnego → komunikat o ponownym logowaniu.
- **Brak danych w bazie** dla **pary katalogu** odpowiadającej profilowi (native + język nauki mapowane przez `getCatalogLanguagePair`) — np. seed jest tylko EN↔PL, a użytkownik wybierze inną parę.
- **RLS** blokuje odczyt → pustka.
- **Fallback CEFR:** jeśli dla `displayLevel` nie ma rekordów, zapytanie bez filtra CEFR (limit 8000) dla tej samej **pary katalogu**.
