# Prebuild + `@bacons/apple-targets` (widget iOS)

## Błąd: `Cannot read properties of undefined (reading 'removeFromProject')`

Przy **drugim** `expo prebuild` **bez** `--clean` plugin próbuje **zaktualizować** istniejący target `WordlyWidget` w `ios/`. W połączeniu z modami `xcodeProjectBeta2` potrafi to się wywalić na `buildConfigurationList` (znany edge case).

### Rozwiązanie

1. **Zawsze** używaj skryptu z repozytorium (ma `--clean`):

   ```bash
   npm run ios:prebuild
   ```

2. Albo ręcznie:

   ```bash
   rm -rf ios
   npx expo prebuild --platform ios --clean
   ```

3. Ustaw **`APPLE_TEAM_ID`** w `.env` (10 znaków z Apple Developer → Membership), żeby zniknął warning `[bacons/apple-targets] ... ios.appleTeamId` i żeby podpis był spójny. Wczytuje to `app.config.ts`.

## Dlaczego `--clean`

Czyści wygenerowany `ios/` przed ponowną generacją, więc plugin zwykle idzie ścieżką **tworzenia** targetu zamiast **aktualizacji** — omija powyższy crash.

Jeśli musisz iterować na istniejącym `ios/` bez kasowania (szybszy cykl), buduj w Xcode po pierwszym udanym prebuildzie; pełny `prebuild` bez `--clean` z widgetem bywa ryzykowny do czasu poprawek w upstream `@bacons/apple-targets`.
