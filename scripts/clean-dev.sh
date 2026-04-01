#!/usr/bin/env bash
# Czyszczenie artefaktów dev/test (Expo, web), opcjonalnie cache Xcode — NIE usuwa node_modules.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Wordly: .expo, dist, web-build"
rm -rf .expo dist web-build

case "${1:-}" in
  --xcode)
    echo "→ Xcode DerivedData (~/Library/Developer/Xcode/DerivedData/*)"
    rm -rf "${HOME}/Library/Developer/Xcode/DerivedData/"*
    echo "  Gotowe. Następny build Xcode będzie od zera (dłuższy)."
    ;;
  --sim-unavailable)
    echo "→ simctl delete unavailable"
    xcrun simctl delete unavailable 2>/dev/null || true
    echo "  Gotowe."
    ;;
  --help|-h)
    echo "Użycie: bash scripts/clean-dev.sh [opcja]"
    echo "  (brak)         — tylko .expo, dist, web-build w projekcie"
    echo "  --xcode        — czyści DerivedData (dużo miejsca, bezpieczne)"
    echo "  --sim-unavailable — usuwa niedostępne wpisy symulatorów"
    exit 0
    ;;
  "")
    echo "  Gotowe."
    ;;
  *)
    echo "Nieznana opcja: $1 — użyj --help"
    exit 1
    ;;
esac
