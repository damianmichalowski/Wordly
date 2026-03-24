# iOS prebuild (`expo prebuild`)

## `npm install` a łatka `@bacons/apple-targets`

Po **`npm install`** katalog `node_modules` jest instalowany od zera. Drobna łatka na plugin **`@bacons/apple-targets`** (naprawa `removeFromProject` przy Expo 55 / drugim prebuildzie) jest trzymana w **`patches/@bacons+apple-targets+4.0.6.patch`**.

Skrypt **`postinstall`** w `package.json` uruchamia **`patch-package`**, więc **po każdym `npm install` łatka wraca sama**. Nie musisz nic robić ręcznie przed `npm install` — wystarczy że w repo jest folder `patches/` i wpis `"postinstall": "patch-package"`.

Jeśli kiedyś usuniesz `patch-package` lub folder `patches/`, błąd przy `expo prebuild` może wrócić.

## Zalecana kolejność (świeży klon / po `rm -rf node_modules`)

```bash
# w katalogu głównym repozytorium
cp .env.example .env   # uzupełnij EXPO_PUBLIC_* i opcjonalnie APPLE_TEAM_ID
npm install            # zainstaluje paczki + nałoży patch (postinstall)
rm -rf ios             # opcjonalnie, przy problemach ze starym projektem Xcode
npx expo prebuild --platform ios
# lub
npx expo run:ios
```

## `APPLE_TEAM_ID`

Ustaw w `.env` (10 znaków z Apple Developer → Membership), żeby `@bacons/apple-targets` i podpis nie ostrzegały o braku teamu.
