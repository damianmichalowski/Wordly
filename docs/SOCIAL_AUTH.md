# Logowanie Google i Apple — instrukcja krok po kroku

Stałe w projekcie (nie zmieniaj bez powodu):

| Co | Wartość |
|----|---------|
| Scheme (deeplink) | `wordly` (z `app.json` → `expo.scheme`) |
| iOS Bundle ID | `com.wordly.mobile` |
| Android package | `com.wordly.mobile` (z `app.config.ts`) |
| Ścieżka OAuth w kodzie | `auth/callback` → redirect wygląda jak `wordly://auth/callback` (tylko fallback / web) |
| Google w aplikacji | Natywny Sign-In + `signInWithIdToken` — env: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` |

---

## Część A — projekt lokalny (Wordly)

### A1. Plik `.env` w katalogu głównym repozytorium

Skopiuj `.env.example` → `.env` i uzupełnij:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ... (anon public z Supabase)
```

Opcjonalnie dla buildów iOS z Apple:

```env
APPLE_TEAM_ID=XXXXXXXXXX
```

(`Membership` na [developer.apple.com](https://developer.apple.com/account) — 10 znaków.)

### A2. Migracje bazy (nowy schemat)

Po dodaniu plików SQL w `supabase/migrations/` zastosuj je w projekcie (Supabase CLI: `supabase db push`, albo **SQL Editor**). Szczegóły: `supabase/README.md`.

### A3. Build aplikacji (moduły natywne)

Po pierwszej instalacji pakietów auth:

```bash
# w katalogu głównym repozytorium
npx expo prebuild
# albo od razu:
npx expo run:ios
npx expo run:android
```

Logowanie **Apple** testuj na **fizycznym iPhone** (symulator bywa problematyczny). **Google** na urządzeniach z natywną konfiguracją (poniżej) używa **okna Google** — bez widocznej strony `supabase.co` w przeglądarce.

---

### A3a. Natywne Google Sign-In (zalecane — iOS / Android)

Aplikacja używa `@react-native-google-signin/google-signin` + `signInWithIdToken` w Supabase. Dodaj do **`.env`** (wartości z Google Cloud — część C):

```env
# Klient typu „Web application” (ten sam co Secret w Supabase → Google)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-xxxxx.apps.googleusercontent.com
# Osobny klient typu „iOS” (Bundle ID: com.wordly.mobile) — wymagany na iOS + do pluginu Expo (URL scheme)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789-yyyyy.apps.googleusercontent.com
```

Po pierwszej konfiguracji lub zmianie tych zmiennych: **`npx expo prebuild`** (plugin dopisuje URL scheme do iOS), potem `npx expo run:ios` / `run:android`.

Na **Android** w Google Cloud utwórz też klienta typu **Android** (`com.wordly.mobile` + SHA-1 — patrz C3) i **dopisz jego Client ID** w Supabase razem z Web/iOS (pole **Client IDs**).

---

## Część B — Supabase (dashboard: [supabase.com](https://supabase.com) → Twój projekt)

### B1. Dane API do `.env`

1. **Project Settings** (ikona zębatki) → **API**.
2. Skopiuj:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** → `EXPO_PUBLIC_SUPABASE_ANON_KEY**

### B2. Redirect URLs (dla OAuth w przeglądarce / web / fallback)

Przy **natywnym** Google na iOS/Android użytkownik **nie przechodzi** przez ten redirect w Safari — nadal warto mieć wpis na wypadek **web** lub gdy brakuje zmiennych `EXPO_PUBLIC_GOOGLE_*`.

1. W menu: **Authentication** → **URL Configuration**.
2. Pole **Redirect URLs** — dodaj **każdy** adres, którym aplikacja może wrócić po logowaniu:

   **Minimalnie dodaj (produkcja / dev client ze scheme `wordly`) — dokładnie ten string (fallback OAuth wysyła go na sztywno):**

   ```
   wordly://auth/callback
   ```

   Nie polegaj na „automatycznym” URI z Metro (`Linking.createURL`), jeśli różni się o ukośniki — Supabase porównuje **literał**; zły adres → redirect na **Site URL** (localhost) i błąd w Safari.

   **Development (Expo Go / Metro)** — często coś w stylu:

   ```
   exp://127.0.0.1:8081/--/auth/callback
   ```

   albo z IP sieci lokalnej. **Najprościej:** uruchom aplikację, spróbuj „Kontynuuj z Google”; jeśli Supabase zwróci błąd „redirect_uri”, skopiuj dokładny URI z komunikatu i **dopisz go** tutaj.

3. **Site URL** może zostać np. `http://localhost:3000` lub URL produkcyjny — ważniejsze są **Redirect URLs**.

### B3. Provider Google

1. **Authentication** → **Providers** → **Google**.
2. Włącz (**Enable**).
3. **Client ID** i **Client Secret** — z klienta typu **Web application** w Google Cloud (C2).
4. Pole **Client IDs** (lub równoważne pole na listę ID) — **dopisz wszystkie** ID OAuth używane w aplikacji: **Web**, **iOS**, **Android** (oddzielone przecinkami, bez spacji w środku). Supabase musi akceptować tokeny wydane dla któregokolwiek z nich. *Webowy Client ID powinien być pierwszy na liście*, jeśli panel tego wymaga (patrz [dokumentacja](https://supabase.com/docs/guides/auth/social-login/auth-google)).
5. Dla **natywnego iOS** włącz **Skip nonce check** (jeśli opcja jest w panelu).
6. Zapisz (**Save**).

### B4. Provider Apple (natywna apka iOS — Wordly)

U Was logowanie jest **natywne** (`expo-apple-authentication` + `signInWithIdToken`). Według [Supabase](https://supabase.com/docs/guides/auth/social-login/auth-apple): *„If you're building a native app only, you do not need to configure the OAuth settings.”* — czyli **nie** musisz na start robić Services ID ani sekretu z `.p8` (to jest pod OAuth / web).

**Krok po kroku:**

1. **[Apple Developer](https://developer.apple.com/account)** → **Certificates, Identifiers & Profiles** → **Identifiers**.

2. **App ID** (typ *App IDs*):
   - Znajdź lub utwórz identyfikator z **Bundle ID** dokładnie: `com.wordly.mobile` (tak jak w projekcie).
   - W **Capabilities** włącz **Sign In with Apple** → zapisz.

3. **Supabase** → **Authentication** → **Providers** → **Apple**:
   - Włącz (**Enable**).
   - Pole **Client IDs** (lista po przecinku, bez spacji problematycznych):
     - zawsze: `com.wordly.mobile`
     - jeśli testujesz w **Expo Go**: dopisz też `host.exp.Exponent` (Apple wtedy używa tego bundle ID).
     - Przykład: `com.wordly.mobile,host.exp.Exponent`
   - Pola typu **Secret / OAuth** — przy **tylko natywnym** iOS często zostają puste lub nie są wymagane; jeśli panel Supabase **wymusi** sekret, wtedy dopiero dodajesz konfigurację **Web OAuth** (Services ID + klucz `.p8`) — opis w [Configuration: Web OAuth](https://supabase.com/docs/guides/auth/social-login/auth-apple#configuration-web-oauth).

4. **Build iOS:** `usesAppleSignIn: true` jest w `app.config.ts`; opcjonalnie `APPLE_TEAM_ID` w `.env`. Po zmianach: `npx expo prebuild` / `npx expo run:ios`.

5. **Test:** Sign in with Apple na **fizycznym iPhone** (symulator bywa ograniczony).

---

## Część C — Google Cloud Console

### C1. Projekt i ekran zgody OAuth

1. Wejdź na [Google Cloud Console](https://console.cloud.google.com/).
2. Wybierz lub utwórz **projekt**.
3. Menu **APIs & Services** → **OAuth consent screen**.
4. Ustaw typ (External / Internal), nazwę aplikacji, email — zapisz.

### C2. Klient OAuth typu „Web application” (dla Supabase)

To jest **najważniejszy** klient — jego ID i Secret wklejasz w Supabase (B3).

1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
2. Typ: **Web application**.
3. Nazwa np. `Wordly Supabase`.
4. **Authorized redirect URIs** — dodaj **dokładnie** adres callback Supabase:

   ```
   https://<TWÓJ-PROJECT-REF>.supabase.co/auth/v1/callback
   ```

   `<TWÓJ-PROJECT-REF>` znajdziesz w URL projektu Supabase (np. `abcxyzcompany` z `abcxyzcompany.supabase.co`).

5. Utwórz → skopiuj **Client ID** i **Client Secret** → wklej w Supabase → Google provider (B3).

### C3. Klienci iOS i Android (wymagane przy natywnym Sign-In w aplikacji)

1. **OAuth client ID** → typ **iOS**.
   - **Bundle ID**: `com.wordly.mobile` (jak w projekcie).
   - Skopiuj **Client ID** → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` w `.env` (A3a). Ten sam string dopisz w Supabase → Google → **Client IDs** (B3).

2. **OAuth client ID** → typ **Android**.
   - **Package name**: `com.wordly.mobile`.
   - **SHA-1** certyfikatu podpisu: dla debug wejdź w `android/` i uruchom `./gradlew signingReport` (lub z Android Studio *Gradle* → *signingReport*) — skopiuj SHA-1 dla `debug` i ewentualnie release. Wklej w Google Cloud przy kliencie Android.
   - Skopiuj **Client ID** klienta Android i dopisz go w Supabase → Google → **Client IDs** (B3).

Bez klienta iOS **nie zadziała** natywny Google Sign-In na iPhone (brak URL scheme z pluginu Expo). Bez klienta Android + SHA-1 logowanie na Androidzie często kończy się `DEVELOPER_ERROR`.

---

## Część D — Apple Developer (tylko Sign in with Apple)

1. [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles**.
2. **Identifiers** → App ID (`com.wordly.mobile`) → włącz **Sign In with Apple**.
3. Utwórz **Services ID** (dla OAuth) i klucz **p8** (Sign in with Apple Key) — szczegóły w [Supabase: Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple?platform=apple).
4. W Supabase (B4) wklej te same dane (Service ID, Key ID, Team ID, treść klucza `.p8`).
5. W projekcie Xcode / Expo: `APPLE_TEAM_ID` w `.env` dla `app.config.ts` (już jest obsługa).

---

## Część E — weryfikacja

1. Uruchom app z poprawnym `.env`.
2. Ekran onboardingu → **Kontynuuj z Google** → zaloguj się kontem testowym.
3. W Supabase: **Authentication** → **Users** — powinien pojawić się nowy użytkownik (email lub provider Google).
4. Dokończ onboarding do końca — w **Table Editor** sprawdź `public.profiles` (wiersz z `user_id`).

### Typowe błędy

| Objaw | Co zrobić |
|--------|-----------|
| `redirect_uri_mismatch` (Google) | W Google Cloud (C2) musi być dokładnie `https://<ref>.supabase.co/auth/v1/callback`. |
| Błąd Supabase o „redirect” po powrocie z przeglądarki | Dopisz brakujący redirect w **B2** (np. `wordly://auth/callback` lub `exp://...`). |
| `DEVELOPER_ERROR` / błąd Google na Androidzie | SHA-1 debug/release w kliencie Android (C3); `com.wordly.mobile`; Client ID w Supabase (B3). |
| Supabase odrzuca token po natywnym Google | W **B3** w polu Client IDs muszą być **wszystkie** ID (Web, iOS, Android); często **Web pierwszy**; iOS: **Skip nonce check**. |
| Apple: brak `identityToken` | Urządzenie fizyczne, poprawny Team ID, capability na App ID. |
| „Invalid API key” | Sprawdź `EXPO_PUBLIC_SUPABASE_*` i restart Metro (`npx expo start -c`). |

### Po Google widzę stronę Supabase (`https://…supabase.co/…`) z tekstem w stylu „Przejdź do aplikacji” / linkiem

**To nie jest Twój błąd w kodzie** — taki flow jest **z założenia**:

1. **Google** po zalogowaniu przekierowuje na **serwer Supabase**:  
   `https://<twój-projekt>.supabase.co/auth/v1/callback`  
   (stąd w pasku adresu często widać `…supabase.co` — np. `qb…` to fragment ref projektu.)
2. **Supabase** wymienia kod na sesję i **potem** ma przekierować do aplikacji na adres z kodu:  
   `wordly://auth/callback?…`

Jeśli **zostajesz** na stronie z linkiem zamiast automatycznego powrotu do Wordly:

- Sprawdź **Authentication → URL Configuration → Redirect URLs** — musi być dokładnie: `wordly://auth/callback` (patrz B2).
- Upewnij się, że testujesz **development build** (`expo run:ios`), nie samą przeglądarkę — deep link `wordly://` otwiera tylko zainstalowaną aplikację.
- W razie potrzeby **tapnij** „Otwórz w aplikacji” / link — czasem ASWebAuthenticationSession nie przechwyci od razu przekierowania.

**Google Cloud:** w **Authorized redirect URIs** zostaje **tylko** `https://<ref>.supabase.co/auth/v1/callback` — **nie** dodajesz tam `wordly://` (to wyłącznie w Supabase Redirect URLs).

---

### Czy użytkownik Wordly „powinien widzieć” Supabase?

**Z punktu widzenia produktu:** najlepiej, żeby widział głównie **Google** (wybór konta), a potem **od razu wracał do Wordly**.

- **Domyślnie na iOS/Android** (gdy ustawisz `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` i na iOS `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` — A3a): **natywny** Google Sign-In + `signInWithIdToken` — **bez** strony `supabase.co` w przeglądarce.
- **Fallback** (brak tych zmiennych / **web**): `signInWithOAuth` + przeglądarka — w środku łańcucha bywa widoczny adres Supabase (sekcja wyżej i B2).
- **Gdy użytkownik musi klikać „przejdź do aplikacji” albo długo widzi stronę Supabase** przy fallbacku — zwykle **Redirect URLs** / deep link (B2); przy natywnym flow ten problem znika.

---

### Safari pokazuje „localhost” / „nie może otworzyć strony” po Google

To **nie jest** błąd Google ani telefonu — **Supabase** po zalogowaniu robi ostatnie przekierowanie na adres **„powrotu”** do aplikacji. Jeśli ten adres **nie jest** na liście **Redirect URLs**, Supabase używa domyślnego **Site URL**, który często jest ustawiony na `http://localhost:3000`.

Na **iPhonie** `localhost` oznacza **sam telefon**, nie Twój komputer — w Safari nie ma tam żadnej strony, stąd błąd.

**Co zrobić:**

1. W konsoli Metro (tryb dev) po starcie logowania zobaczysz log:  
   `[auth] OAuth redirect URI …` — **skopiuj dokładnie ten string** (np. `wordly:///auth/callback` lub `exp://192.168.x.x:8081/--/auth/callback`).
2. Supabase → **Authentication** → **URL Configuration** → **Redirect URLs** → **Add URL** → wklej **ten sam** adres co w logu (plus ewentualnie `wordly://auth/callback` jeśli różni się liczbą ukośników — ważna jest **dokładna zgodność**).
3. Opcjonalnie zmień **Site URL** z `http://localhost:3000` na coś sensownego (np. `https://twoja-domena.pl` albo ten sam deep link co w pkt. 1), żeby domyślne przekierowanie nie trafiało w localhost na urządzeniu.

**Przypomnienie:** W Google Cloud (C2) w **Authorized redirect URIs** jest tylko callback **Supabase**: `https://<ref>.supabase.co/auth/v1/callback`. Adres `wordly://…` dodajesz **wyłącznie w Supabase** (Redirect URLs), nie w Google Cloud.

**„Localhost nie znika” / wisi pusta strona po Google:** Supabase **nie** dopuścił `redirect_to` → użył **Site URL** (`localhost`). Zrób **(1)** Redirect URLs — dokładnie ten string co w logu Metro `[auth] OAuth redirect (native)` (np. `wordly://auth/callback`), **(2)** **Site URL** ustaw na **cokolwiek innego niż** `http://localhost:…` (np. `https://supabase.com` albo docelowy HTTPS), **(3)** najpewniej: **natywne Google** (`EXPO_PUBLIC_GOOGLE_*` w `.env` — A3a), żeby w ogóle nie przechodzić przez Safari/OAuth.

---

## Skrót — kolejność

1. `.env` z URL i anon key (B1).  
2. Migracje SQL (A2).  
3. Google Cloud: Web (C2) + iOS + Android (C3) → Client ID + Secret + **wszystkie** Client IDs w Supabase (B3).  
4. `.env`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (A3a).  
5. Supabase: Redirect URLs (B2) — na wypadek web / fallback.  
6. Opcjonalnie Apple (D + B4).  
7. `npx expo prebuild` (plugin Google iOS) → `run:ios` / `run:android` (A3).  
8. Test logowania (E).
