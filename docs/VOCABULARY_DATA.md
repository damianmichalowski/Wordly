# Skąd brać słowa i jak zasilać bazę (CEFR, Oxford, pary językowe)

## 1. Oxford vs „bazy CEFR” — najpierw prawo

| Źródło | Typowo | Uwagi produktowe |
|--------|--------|------------------|
| **Oxford 3000 / 5000** (oficjalne listy OUP) | **Własność Oxford University Press** | Do aplikacji komercyjnej potrzebujesz **licencji od wydawcy**, nie wystarczy „ściągnięcie z internetu”. |
| **Listy „Oxford” na GitHubie** | Często **nieoficjalne kopie** | Ryzyko prawne + brak gwarancji kompletności. Traktuj jako **inspirację**, nie jako źródło do redystrybucji. |
| **Datasety CEFR (np. Words-CEFR-Dataset, CEFR-J itd.)** | Zwykle **MIT / CC** (sprawdź plik `LICENSE` w repo) | Sensowny punkt startu pod **angielski + poziom CEFR**, pod warunkiem **cytowania** zgodnie z licencją. |
| **Wiktionary / Wikidata** | **Otwarte licencje** (np. CC BY-SA, ODbL) | Dobre pod **formy, tłumaczenia, przykłady** — wymaga przetworzenia i **atrybucji** w aplikacji lub w docs. |

**Rekomendacja na start:** buduj **pipeline legalny**: tylko źródła z **jasną licencją** + pole `provenance` / notka w `About` w aplikacji.

---

## 2. Co jest „najlepiej” dla Wordly (MVP → produkt)

### Problem produktowy

Ty potrzebujesz **par** `(source_lang, target_lang, source_text, target_text, cefr_level, …)` — typowe listy „CEFR English” to często **tylko jeden język** (np. angielskie lematy + poziom).

### Ścieżki sensowne

**A) MVP szybki (jeden kierunek, np. PL → EN)**  
1. **Lewa kolumna (PL):** krótka lista kontrolowana (własna / z legalnego słownika) albo wygenerowana ręcznie dla pilota.  
2. **Prawa kolumna (EN):** poziom CEFR z **otwartego datasetu** (np. klasyfikacja po **lemacie angielskim**).  
3. **Mapowanie:** ręcznie / półautomatycznie (CSV) — akceptowalne dla pierwszych setek słów.

**B) Skalowalnie (wiele par)**  
- **Katalog „huby”** (np. angielski jako L2): jedna lista EN + CEFR, potem tłumaczenia na inne języki z **Wikidata / Wiktionary** (lematy + sensy).  
- **Zdania przykładowe:** **Tatoeba** (CC BY) — osobny pipeline dopasowany do `word_id`.

**C) Premium później**  
- Licencjonowany słownik (Oxford, Collins, itd.) — wtedy masz pewność prawną i jakość.

---

## 3. Jak technicznie zasilać Supabase

1. **Nie wklejaj `service_role` do aplikacji mobilnej.**  
2. **Import wsadowy** jednym z:
   - **SQL Editor** w Supabase (duże `INSERT` / `COPY` z CSV wklejonym z pliku),
   - skrypt **lokalny** (Node/Python) z `SUPABASE_SERVICE_ROLE_KEY` tylko na Twoim komputerze / CI,
   - przyszłościowo: **Edge Function** wywoływana tylko z zaufanej roli admina.

3. **Staging (opcjonalnie):** tabela `vocabulary_import_staging` → walidacja → `INSERT` do `vocabulary_words`.

4. **Unikalność:** masz już constraint  
   `(source_language_code, target_language_code, source_text, target_text)` — import musi go respektować (normalizacja: trim, lowercase policy — ustal jedną).

5. **RLS:** obecnie `vocabulary_words` ma tylko **SELECT** dla klientów — **insert z aplikacji użytkownika nie jest potrzebny**; zasilanie = **admin / migracja**.

---

## 4. Konkretny plan na najbliższe 2 tygodnie

1. Wybierz **jeden** otwarty dataset angielski + CEFR (sprawdź `LICENSE`).  
2. Zdefiniuj **jedną** parę językową MVP (np. `pl` → `en`).  
3. Przygotuj **CSV** z kolumnami zgodnymi z `vocabulary_words` (minimum: teksty, `cefr_level`, opcjonalnie przykłady).  
4. Zaimportuj **partiami** (np. 500–2000 słów) i przetestuj w aplikacji.  
5. Dopisz w UI **Credits / Źródła danych** zgodnie z licencją.

---

## 5. Przykładowe repozytoria do własnej weryfikacji licencji

- [Maximax67/Words-CEFR-Dataset](https://github.com/Maximax67/Words-CEFR-Dataset) — często cytowany; **sprawdź `LICENSE` przed użyciem komercyjnym**.  
- Projekty **CEFR-J** / **Open Language Profiles** — dobre pod badania; licencje bywają **CC** — wymagana atrybucja.

**Oxford:** jeśli produkt ma się nazywać lub opierać na markach Oxford, rozważ **oficjalną licencję API / treści** — to osobna decyzja biznesowa, nie techniczna.

---

## 6. Opcjonalne rozszerzenie schematu (później)

Kolumny typu `data_source`, `license_code`, `source_url` przy `vocabulary_words` ułatwią audyt i kolejne importy — można dodać migracją, gdy ustalisz pierwsze źródło.

**Model relacyjny (lemma → znaczenia → przykłady, CEFR na znaczeniu):** zob. [VOCABULARY_ARCHITECTURE.md](./VOCABULARY_ARCHITECTURE.md) i migrację `20260321100000_vocabulary_lemmas_senses_examples.sql`.

---

## 7. Model hybrydowy (baza + API) — pod skalowanie

**Cel:** jedna spójna baza w Supabase (słowo dnia, widget, offline), a **bogactwo** (IPA, audio, dodatkowe znaczenia) z API **wtedy, gdy ToS na to pozwala**.

| Warstwa | Co trzymasz | Po co |
|--------|----------------|--------|
| **Rdzeń (Twoja baza)** | para językowa, `cefr_level`, opcjonalnie `deck_id` / `category`, minimalny tekst | wybór słowa, SRS, widget, niski koszt |
| **Wzbogacenie (API)** | na żądanie lub krótki cache zgodny z regulaminem | wymowa, extra przykłady, gdy nie masz własnego nagrania |

**Skalowalność kosztów:** przy dużej liczbie użytkowników ograniczasz wywołania API (cache serwerowy Edge, batch job), albo przechodzisz na **płatną paczkę danych** / własne nagrania.

---

## 8. Decki / kategorie („LoL”, „Isaac”, itd.) — produkt + architektura

To jest **osobny wymiar** obok CEFR: użytkownik wybiera **zestaw** (np. „słówka ogólne B2” vs „motywy z gry X”).

**W bazie (wdrożone):** tabele **`decks`** i **`deck_words`** (relacja M:N). Z `vocabulary_words` usunięto `deck_id`; pole `category` zostaje jako tag.

- Plik migracji + seed: `supabase/migrations/20260221140000_decks_many_to_many_seed.sql`
- Przykład: 6 słów, 2 decki (`wordly_seed`, `pl_en`), 9 wierszy w `deck_words` (te same 3 słowa PL→EN w obu deckach).

**Treść „z uniwersum gry”:**

- Słowa można układać **własnoręcznie** lub z legalnych źródeł (np. wiki pod CC BY-SA z atrybucją).
- **Znaki towarowe:** nazwa decka typu „Słówka w stylu fantasy RPG” jest bezpieczniejsza niż sugerowanie oficjalnej współpracy z Riot / twórcą gry bez licencji. W UI: krótka notka „niepowiązane z …” jeśli prawnik tak zaleci.

**Wybór w aplikacji:** profil użytkownika / ustawienia: `active_deck_id` lub filtr w daily-word pipeline (już zaplanowany w produkcie).

---

## 9. „Lista ze wszystkimi parametrami za darmo” — realistycznie

**Pełny zestaw pól** (tłumaczenie, IPA, audio, przykłady, audio zdań, synonimy) **za 0 zł i 100% legalnie** zwykle oznacza:

- **własna redakcja** + **otwarte zasoby** (Wiktionary itd.) + **roboty TTS** (Expo Speech już macie) zamiast nagrań lektora, **albo**
- **mieszanka:** rdzeń z otwartych datasetów + **API** tylko tam, gdzie licencja i budżet na to pozwalają.

**„About / Źródła”** — dokładnie to, co chcesz robić: ekran lub sekcja z:

- listą datasetów / API z **linkiem i nazwą licencji**,
- tekstem atrybucji wymaganym przez CC BY / MIT,
- ewentualnie „Dane słownikowe © …” zgodnie z umową API.

To **nie zastępuje** przestrzegania ToS API (np. limit cache) — uzupełnia warstwę **transparentności** dla użytkownika.

---

## 10. Checklist compliance (krótko)

- [ ] Dla każdego importu: plik `LICENSE` + zapis w arkuszu **źródeł**.
- [ ] W aplikacji: **Settings → Źródła danych** (lub **About**).
- [ ] Dla API: przeczytaj **ToS** (cache, redistribution, atrybucja).
- [ ] Dla decków „z gier”: rozważ **formułę prawną** przy nazewnictwie (marki).
- [ ] Opcjonalnie migracja: `data_source`, `license_code` na `vocabulary_words` / `decks`.
