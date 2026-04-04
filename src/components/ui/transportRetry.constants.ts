/**
 * Jednolity copy dla błędów transportu (sieć / timeout / retryable).
 * Nie używać do stanów biznesowych (onboarding, pusta biblioteka, brak słowa po sukcesie RPC).
 */
export const TRANSPORT_RETRY_TITLE = "Nie udało się wczytać";
export const TRANSPORT_RETRY_SUBTITLE =
  "Sprawdź połączenie z internetem i spróbuj ponownie.";
export const TRANSPORT_RETRY_CTA = "Spróbuj ponownie";

/** Mutacja zapisu — nigdy nie pokazuj surowego `Error.message` (np. TypeError / network). */
export const USER_FACING_SETTINGS_SAVE_FAILED =
  "Nie udało się zapisać ustawień. Sprawdź połączenie i spróbuj ponownie.";

/** Logowanie OAuth — Alert bez technicznych treści z wyjątków. */
export const USER_FACING_SIGN_IN_FAILED =
  "Nie udało się zalogować. Sprawdź połączenie i spróbuj ponownie.";
