import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  isAppleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
} from '@/src/services/auth/socialAuth';
import { getAuthenticatedUserId } from '@/src/services/auth/ensureSession';
import { isOnboardingComplete } from '@/src/services/storage/onboardingStorage';
import {
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  primarySolidPressStyle,
  surfacePressStyle,
} from '@/src/components/ui/interaction';
import { StitchColors, StitchFonts, StitchRadius } from '@/src/theme/wordlyStitchTheme';

export default function OnboardingScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [alreadyOnboarded, setAlreadyOnboarded] = useState(false);

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  /** Już zalogowany + profil zapisany → od razu do aplikacji (np. po wejściu z `/`). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const onboarded = await isOnboardingComplete();
      const uid = await getAuthenticatedUserId();
      if (!cancelled && onboarded && uid) {
        router.replace('/(tabs)/home');
      }
      if (!cancelled) {
        setAlreadyOnboarded(onboarded);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const afterSuccessfulSignIn = useCallback(async () => {
    const onboarded = await isOnboardingComplete();
    if (onboarded) {
      router.replace('/(tabs)/home');
      return;
    }
    router.push('/(onboarding)/language-pair');
  }, [router]);

  const onGoogle = useCallback(async () => {
    setBusy(true);
    const result = await signInWithGoogle();
    setBusy(false);
    if (result.ok) {
      await afterSuccessfulSignIn();
      return;
    }
    Alert.alert('Google', result.message);
  }, [afterSuccessfulSignIn]);

  const onApple = useCallback(async () => {
    setBusy(true);
    const result = await signInWithApple();
    setBusy(false);
    if (result.ok) {
      await afterSuccessfulSignIn();
      return;
    }
    Alert.alert('Apple', result.message);
  }, [afterSuccessfulSignIn]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wordly</Text>
      <Text style={styles.subtitle}>
        {alreadyOnboarded
          ? 'Zaloguj się ponownie, aby wczytać słowa i postęp z konta (sesja wygasła lub wylogowano).'
          : 'Zaloguj się, aby zapisywać postęp i profil w Supabase. Wybierz konto Google lub Apple (iOS).'}
      </Text>

      <Pressable
        android_ripple={ANDROID_RIPPLE_PRIMARY}
        style={({ pressed }) => [
          styles.primaryButton,
          busy && styles.buttonDisabled,
          primarySolidPressStyle(pressed, busy),
        ]}
        onPress={onGoogle}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={StitchColors.onPrimary} />
        ) : (
          <Text style={styles.primaryButtonText}>Kontynuuj z Google</Text>
        )}
      </Pressable>

      {Platform.OS === 'ios' && appleAvailable ? (
        <Pressable
          android_ripple={ANDROID_RIPPLE_SURFACE}
          style={({ pressed }) => [
            styles.appleButton,
            busy && styles.buttonDisabled,
            surfacePressStyle(pressed, busy),
          ]}
          onPress={onApple}
          disabled={busy}
        >
          <Text style={styles.appleButtonText}>Kontynuuj z Apple</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    padding: 24,
    gap: 14,
    backgroundColor: StitchColors.surface,
  },
  title: {
    fontSize: 32,
    fontFamily: StitchFonts.display,
    color: StitchColors.primary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.xl,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    shadowColor: StitchColors.onSurface,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  primaryButtonText: {
    color: StitchColors.onPrimary,
    fontFamily: StitchFonts.bodySemi,
    fontSize: 16,
  },
  appleButton: {
    backgroundColor: StitchColors.onSurface,
    borderRadius: StitchRadius.xl,
    paddingVertical: 16,
    alignItems: 'center',
  },
  appleButtonText: {
    color: StitchColors.surfaceContainerLowest,
    fontFamily: StitchFonts.bodySemi,
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
