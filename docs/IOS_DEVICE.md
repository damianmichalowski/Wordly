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
# w katalogu głównym repozytorium
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

## 6. Jeden cel buildu (symulator vs iPhone) — mniej chaosu i typowy błąd

**`npx expo run:ios` bez flag** czasem pamięta **stary** symulator (UDID), którego już nie ma → Xcode zwraca:

`Unable to find a destination matching … { id: … }` (kod **70**).

**Co zrobić:**

1. **Tylko fizyczny iPhone (polecane do testów „na żywo”)** — zwykle:
   ```bash
   npx expo run:ios --device
   ```
   albo skrypt: `npm run ios:device`  
   (telefon USB, odblokowany, zaufany komputerowi.)

   **Pułapka:** lista urządzeń w Expo **miesza** prawdziwy iPhone ze **starymi symulatorami** o podobnej nazwie. Jeśli wybierzesz np. **„iphone 16 pro (18.5)”**, a pod spodem to jest **symulator** z innym runtime’em niż ten, którego używa `xcodebuild`, dostaniesz błąd **`Unable to find a destination … id:20C8DF86-…`** (exit **70**).

   **Jak rozróżnić:** w terminalu:
   ```bash
   xcrun xctrace list devices
   ```
   - Sekcja **`== Devices ==`** — fizyczny telefon (np. `iPhone … (26.3.1) (00008110-…)`).
   - Sekcja **`== Simulators ==`** — symulatory; wpis typu **`iphone 16 pro Simulator (18.5)`** to **nie** kabel USB.

   **Naprawa (najpewniejsza):** podłącz iPhone i podaj **UDID fizycznego urządzenia** (ten z `Devices`, zaczyna się często od `00008…`):
   ```bash
   npx expo run:ios --device 00008110-0015244C0EBA401E
   ```
   (Zamień na **swój** UDID z `xcrun xctrace list devices` → **Devices**.)

   **Albo usuń „martwy” symulator**, żeby nie wyskakiwał w wyborze (ostrożnie — tylko jeśli to naprawdę niepotrzebny sim):
   ```bash
   xcrun simctl delete 20C8DF86-9D30-439D-9B30-7D35B5C11F99
   ```
   Jeśli `simctl` zwróci błąd, usuń go w **Xcode → Window → Devices and Simulators → Simulators** (prawy klik → Delete).

2. **Konkretny symulator z listy** — podaj **nazwę** dokładnie tak, jak w Xcode / `xcrun simctl list`:
   ```bash
   npx expo run:ios -d "iPhone 17"
   ```
   Listę ID i nazw zobaczysz też w komunikacie błędu (`Available destinations`) albo:
   ```bash
   xcrun simctl list devices available
   ```

3. **Stały skrypt w `package.json`** — jest `npm run ios:sim` (domyślnie jedna nazwa symulatora); **zmień nazwę** w `package.json` na ten jeden model, którego używasz codziennie.

4. **Ostrzeżenie `@bacons/apple-targets` o `ios.appleTeamId`** — ustaw w `.env` (patrz `.env.example`):
   `APPLE_TEAM_ID=XXXXXXXXXX` (10 znaków z [developer.apple.com](https://developer.apple.com) → **Membership**). Po zmianie ewentualnie `npx expo prebuild --platform ios` jeśli coś nadal krzyczy.

### Mniej miejsca na dysku (bez „magicznego” jednego buildu dla wielu urządzeń naraz)

Xcode **zawsze** buduje pod **jedno** wybrane „destination”; rozmiar bierze się głównie z **Pods / DerivedData / runtime’ów symulatorów**.

- **Jeden symulator do devu**: usuń nieużywane symulatory: *Xcode → Window → Devices and Simulators → Simulators* (prawy klik → Delete).
- **Stare runtime’y iOS** (duże): *Xcode → Settings → Platforms* — odinstaluj wersje, których nie potrzebujesz.
- **DerivedData** (cache kompilacji): okresowo *Xcode → Settings → Locations → strzałka przy Derived Data → usunięcie folderu projektu* albo przy buildzie:
  ```bash
  npx expo run:ios --no-build-cache …
  ```
  (następny build będzie dłuższy, ale odświeży cache.)

---

## 7. Typowe problemy

| Problem | Co sprawdzić |
|--------|----------------|
| „Untrusted developer” na iPhone | Ustawienia → Ogólne → VPN i zarządzanie urządzeniem → zaufaj deweloperowi |
| Brak urządzenia na liście | Kabel, zaufanie, odblokowany ekran |
| Build się nie podpisuje | Xcode → Signing & Capabilities → wybierz Team |
| Metro nie łączy | Ta sama sieć Wi‑Fi lub `expo start --tunnel` |
| `Unable to find a destination` / exit 70 | Stary UDID symulatora — użyj `--device` albo `-d "Nazwa"` (sekcja 6 powyżej) |

## 8. Co dalej (gdy będziesz gotów)

- **TestFlight**: EAS Build (`eas build --platform ios`) + App Store Connect
- **Widgety**: `docs/PHASE_8_NATIVE_WIDGETS.md` — wymaga tego samego podejścia co powyżej (prebuild + Xcode)

## Skrót komend

```bash
npm install
npx expo prebuild --platform ios   # pierwszy raz lub po dużych zmianach natywnych
npm start                          # terminal 1 — Metro
npm run ios:device                 # terminal 2 — build na podłączony iPhone (USB)
# albo jeden ustalony symulator (nazwę edytuj w package.json → ios:sim):
npm run ios:sim
```
