import { Platform } from 'react-native';

import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getSupabaseClient, hasSupabaseEnv } from '@/src/lib/supabase/client';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Callback po OAuth: musi być **bajtowo** taki sam jak w Supabase → Authentication → URL Configuration → Redirect URLs.
 *
 * Na iOS/Android: `makeRedirectUri` + normalizacja `wordly:///…` → `wordly://…` (inaczej Supabase odrzuca redirect
 * i używa Site URL, często `http://localhost:3000`, który „nie znika” w WebView).
 */
export function getOAuthRedirectUri(): string {
  if (Platform.OS === 'web') {
    const uri = Linking.createURL('auth/callback');
    if (__DEV__) {
      console.log('[auth] OAuth redirect (web):', uri);
    }
    return uri;
  }

  try {
    const raw = makeRedirectUri({
      scheme: 'wordly',
      path: 'auth/callback',
    });
    const uri = raw.replace(/^wordly:\/\/+/, 'wordly://');
    if (__DEV__) {
      console.log(
        '[auth] OAuth redirect (native). Dopisz w Supabase → Redirect URLs dokładnie:',
        uri,
        raw !== uri ? `(surowe: ${raw})` : '',
      );
    }
    return uri;
  } catch {
    return 'wordly://auth/callback';
  }
}

function isLocalhostAuthUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/.test(url);
}

function parseQueryAndHash(url: string): URLSearchParams {
  const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const hashPart = url.includes('#') ? url.split('#').slice(1).join('#') : '';
  const combined = [queryPart, hashPart].filter(Boolean).join('&');
  return new URLSearchParams(combined);
}

function parseTokensFromCallbackUrl(url: string): { access_token?: string; refresh_token?: string; error?: string } {
  try {
    const params = parseQueryAndHash(url);
    const error =
      params.get('error_description') || params.get('error') || undefined;
    return {
      access_token: params.get('access_token') ?? undefined,
      refresh_token: params.get('refresh_token') ?? undefined,
      error: error ?? undefined,
    };
  } catch {
    return { error: 'invalid_callback_url' };
  }
}

function extractOAuthCode(url: string): string | null {
  const m = url.match(/[?&#]code=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

let googleNativeConfigured = false;

function ensureGoogleNativeConfigured(): void {
  if (googleNativeConfigured) {
    return;
  }
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error('Brak EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId,
    ...(Platform.OS === 'ios' && process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      ? { iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID }
      : {}),
  });
  googleNativeConfigured = true;
}

/**
 * Google: natywny modal Google (bez strony Supabase w przeglądarce) + `signInWithIdToken`.
 * Wymaga klientów OAuth w Google Cloud i wpisania Client IDs w Supabase (patrz docs/SOCIAL_AUTH.md).
 */
async function signInWithGoogleNative(
  supabase: SupabaseClient,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    ensureGoogleNativeConfigured();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Błąd konfiguracji Google.' };
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  try {
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') {
      return { ok: false, message: 'Logowanie anulowane.' };
    }

    let idToken = response.data.idToken;
    let accessToken: string | undefined;

    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken;
      accessToken = tokens.accessToken;
    } else {
      try {
        const tokens = await GoogleSignin.getTokens();
        accessToken = tokens.accessToken;
      } catch {
        /* opcjonalnie dla at_hash */
      }
    }

    if (!idToken) {
      return {
        ok: false,
        message: 'Google nie zwróciło idToken. Sprawdź Client IDs w Supabase (Google provider).',
      };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      ...(accessToken ? { access_token: accessToken } : {}),
    });

    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  } catch (e: unknown) {
    const code =
      e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      return { ok: false, message: 'Logowanie anulowane.' };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Błąd logowania Google.',
    };
  }
}

/** Google przez Supabase OAuth + przeglądarka (web albo fallback gdy brak natywnej konfiguracji). */
async function signInWithGoogleOAuthBrowser(
  supabase: SupabaseClient,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const redirectTo = getOAuthRedirectUri();

  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (oauthError || !data.url) {
    return { ok: false, message: oauthError?.message ?? 'Nie udało się rozpocząć logowania Google.' };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    preferEphemeralSession: true,
  });

  if (result.type !== 'success' || !('url' in result) || !result.url) {
    return { ok: false, message: 'Logowanie anulowane.' };
  }

  try {
    WebBrowser.dismissAuthSession();
  } catch {
    /* noop */
  }

  const url = result.url;
  if (isLocalhostAuthUrl(url)) {
    return {
      ok: false,
      message:
        'Supabase przekierował na localhost zamiast aplikacji. W panelu Supabase → Authentication → URL Configuration: (1) Redirect URLs: dodaj dokładnie: ' +
        redirectTo +
        '  (2) Site URL: ustaw na https:// lub inny niż localhost (localhost na telefonie wskazuje na sam telefon). Szczegóły: docs/SOCIAL_AUTH.md',
    };
  }
  const code = extractOAuthCode(url);

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return { ok: false, message: exchangeError.message };
    }
    return { ok: true };
  }

  const { access_token, refresh_token, error: parseErr } = parseTokensFromCallbackUrl(url);
  if (parseErr && !access_token) {
    return { ok: false, message: parseErr };
  }
  if (access_token && refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sessionError) {
      return { ok: false, message: sessionError.message };
    }
    return { ok: true };
  }

  return { ok: false, message: 'Nie rozpoznano odpowiedzi logowania (sprawdź Redirect URLs w Supabase).' };
}

/**
 * Google: na **iOS/Android** natywny Sign-In (bez widocznego `supabase.co` w przeglądarce), gdy ustawisz
 * `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` oraz na iOS `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
 * Na **web** / bez tych zmiennych OAuth w przeglądarce (jak wcześniej).
 */
export async function signInWithGoogle(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!hasSupabaseEnv()) {
    return { ok: false, message: 'Brak konfiguracji Supabase (EXPO_PUBLIC_SUPABASE_*).' };
  }

  const supabase = getSupabaseClient();
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  const useNativeGoogle =
    Platform.OS !== 'web' &&
    !!webClientId &&
    (Platform.OS === 'android' || !!iosClientId);

  if (useNativeGoogle) {
    return signInWithGoogleNative(supabase);
  }

  return signInWithGoogleOAuthBrowser(supabase);
}

/**
 * Sign in with Apple (iOS): natywny modal + `signInWithIdToken` w Supabase.
 * @platform ios
 */
export async function signInWithApple(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (Platform.OS !== 'ios') {
    return { ok: false, message: 'Sign in with Apple jest dostępne tylko na iOS.' };
  }

  if (!hasSupabaseEnv()) {
    return { ok: false, message: 'Brak konfiguracji Supabase (EXPO_PUBLIC_SUPABASE_*).' };
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    return { ok: false, message: 'Sign in with Apple nie jest dostępne na tym urządzeniu.' };
  }

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    const token = credential.identityToken;
    if (!token) {
      return { ok: false, message: 'Apple nie zwróciło identityToken.' };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token,
      nonce: rawNonce,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true };
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'ERR_REQUEST_CANCELED') {
      return { ok: false, message: 'Logowanie anulowane.' };
    }
    return { ok: false, message: e instanceof Error ? e.message : 'Błąd Apple Sign In.' };
  }
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Kończy sesję Supabase Auth (Google / Apple / inne). */
export async function signOutApp(): Promise<void> {
  if (!hasSupabaseEnv()) {
    return;
  }
  if (Platform.OS !== 'web' && process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch {
      /* brak natywnego modułu lub już wylogowany */
    }
  }
  await getSupabaseClient().auth.signOut();
}
