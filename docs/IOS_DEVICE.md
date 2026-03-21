# Wordly na fizycznym iPhone

Ten przewodnik zakłada, że **pierwsze testy** robisz na **prawdziwym iPhone** (USB lub ten sam Wi‑Fi co Mac).

## Wymagania

- **Mac** z Xcode (najnowsza stabilna z App Store)
- **Konto Apple ID** (darmowe wystarczy do uruchomienia na własnym telefonie przez Xcode)
- Opcjonalnie: **Apple Developer Program** (99 USD/rok) — potrzebne do TestFlight, Ad Hoc dla innych testerów, App Store
- iPhone z **iOS** zgodnym z wymaganiami Expo SDK (patrz [Expo — supported OS versions](https://docs.expo.dev/))

## 1. Bundle ID

W `app.json` jest ustawione:

- `ios.bundleIdentifier`: **`com.wordly.mobile`**

Przed publikacją w App Store **zmień** to na unikalny identyfikator swojej domeny, np. `pl.twojadomena.wordly`. Ten sam ID musi być spójny z App Store Connect.

## 2. Pierwszy build natywny (development)

Expo Go na telefonie nie używa Twojego `bundleIdentifier` ani pełnej konfiguracji — do testów „jak w produkcji” na iPhone używasz **development build**:

```bash
cd wordly-mobile
npm install
npx expo prebuild --platform ios
```

To tworzy folder `ios/` (możesz dodać go do gita lub ignorować — zespół decyduje).

Następnie podłącz iPhone kablem, odblokuj telefon, zaufaj komputerowi, i:

```bash
npm run ios:device
```

albo:

```bash
npx expo run:ios --device
```

Przy pierwszym uruchomieniu Xcode może poprosić o **signing**: wybierz swój **Team** (Apple ID) i pozwól Xcode utworzyć provisioning profile.

## 3. Metro (bundler JS)

Podczas developmentu aplikacja łączy się z Metro na Macu:

- Uruchom w osobnym terminalu: `npm start`
- iPhone musi być w **tej samej sieci Wi‑Fi** co Mac (typowy setup), albo użyj tunelu w Expo (`npx expo start --tunnel`) jeśli sieć blokuje porty.

## 4. Zmienne środowiskowe (Supabase)

Na telefonie `localhost` **nie** wskazuje na Twój Mac w sensie API — jeśli kiedyś podłączysz lokalnego Supabase, użyj adresu sieciowego Maca lub tunelu.

Dla chmury: w projekcie używane są `EXPO_PUBLIC_SUPABASE_*` — ustaw je w `.env` (Expo wczytuje przy starcie). Po zmianie `.env` zrestartuj Metro (`r` w terminalu lub pełny restart).

## 5. Deep link `wordly://`

Scheme jest ustawione w `app.json` jako **`wordly`**. Po zainstalowaniu buildu na iPhone linki `wordly://home?...` powinny otwierać aplikację (test z Notatek / Safari zależnie od iOS).

## 6. Typowe problemy

| Problem | Co sprawdzić |
|--------|----------------|
| „Untrusted developer” na iPhone | Ustawienia → Ogólne → VPN i zarządzanie urządzeniem → zaufaj deweloperowi |
| Brak urządzenia na liście | Kabel, zaufanie, odblokowany ekran |
| Build się nie podpisuje | Xcode → Signing & Capabilities → wybierz Team |
| Metro nie łączy | Ta sama sieć Wi‑Fi lub `expo start --tunnel` |

## 7. Co dalej (gdy będziesz gotów)

- **TestFlight**: EAS Build (`eas build --platform ios`) + App Store Connect
- **Widgety**: `docs/PHASE_8_NATIVE_WIDGETS.md` — wymaga tego samego podejścia co powyżej (prebuild + Xcode)

## Skrót komend

```bash
npm install
npx expo prebuild --platform ios   # pierwszy raz lub po dużych zmianach natywnych
npm start                          # terminal 1 — Metro
npm run ios:device                 # terminal 2 — build i instalacja na iPhone
```
