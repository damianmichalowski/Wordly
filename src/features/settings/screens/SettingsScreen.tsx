import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  DynamicColorIOS,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/src/components/layout/ScreenHeader';
import { CenteredMessageCta } from '@/src/components/ui/CenteredMessageCta';
import {
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  linkPressStyle,
  primarySolidPressStyle,
} from '@/src/components/ui/interaction';
import { SelectionChip } from '@/src/components/ui/SelectionChip';
import { supportedLanguages } from '@/src/constants/languages';
import { useDailyWord } from '@/src/features/dailyWord/useDailyWord';
import { useSettings } from '@/src/features/settings/useSettings';
import { useAppBootstrap } from '@/src/hooks/useAppBootstrap';
import { getSupabaseClient, hasSupabaseEnv } from '@/src/lib/supabase/client';
import { signOutApp } from '@/src/services/auth/socialAuth';
import { clearOnboardingCompletionFlag } from '@/src/services/storage/onboardingStorage';
import { cefrLevels, type CefrLevel } from '@/src/types/cefr';
import type { DisplayLevelPolicy } from '@/src/types/profile';
import { StitchColors, StitchFonts, StitchRadius } from '@/src/theme/wordlyStitchTheme';

/** Kolory jak `Label` / `SecondaryLabel` w iOS (widżet SwiftUI używa `.primary` / `.secondary`). */
const widgetIosLabel =
  Platform.OS === 'ios'
    ? DynamicColorIOS({ light: '#000000', dark: '#FFFFFF' })
    : StitchColors.onSurface;
const widgetIosSecondaryLabel =
  Platform.OS === 'ios'
    ? DynamicColorIOS({ light: 'rgba(60, 60, 67, 0.6)', dark: 'rgba(235, 235, 245, 0.6)' })
    : StitchColors.onSurfaceVariant;
const widgetIosBackground =
  Platform.OS === 'ios'
    ? DynamicColorIOS({ light: '#FFFFFF', dark: '#1C1C1E' })
    : StitchColors.surfaceContainerLowest;

const POLICY_LABEL: Record<DisplayLevelPolicy, string> = {
  'next-level': 'Slightly above level',
  'same-level': 'Same as my level',
  'advanced-mixed': 'Advanced mixed',
};

const CEFR_ROW_LABEL: Record<CefrLevel, string> = {
  A1: 'A1 (Beginner)',
  A2: 'A2 (Elementary)',
  B1: 'B1 (Intermediate)',
  B2: 'B2 (Upper intermediate)',
  C1: 'C1 (Advanced)',
  C2: 'C2 (Proficient)',
};

type PickerKey = 'source' | 'target' | 'level' | 'policy' | null;

function formatSince(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

/** Dwie litery: z imienia i nazwiska albo z części lokalnej adresu e-mail (np. jan.kowalski → JK). */
function getProfileInitials(displayName: string): string {
  const s = displayName.trim();
  if (!s) {
    return 'W';
  }
  if (s.includes('@')) {
    const local = (s.split('@')[0] ?? '').trim();
    const segments = local.split(/[._\-+]+/).filter(Boolean);
    if (segments.length >= 2) {
      const a = segments[0]?.charAt(0) ?? '';
      const b = segments[segments.length - 1]?.charAt(0) ?? '';
      return `${a}${b}`.toUpperCase() || 'W';
    }
    const chunk = (local || 'w').slice(0, 2);
    return chunk.toUpperCase();
  }
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.charAt(0) ?? '';
    const b = parts[parts.length - 1]?.charAt(0) ?? '';
    return `${a}${b}`.toUpperCase();
  }
  const word = parts[0] ?? s;
  if (word.length >= 2) {
    return word.slice(0, 2).toUpperCase();
  }
  return (word.charAt(0) || 'W').toUpperCase();
}

function StitchSettingsRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={ANDROID_RIPPLE_SURFACE}
      style={({ pressed }) => [
        styles.prefRow,
        pressed && !disabled && styles.prefRowPressed,
        disabled && styles.prefRowDisabled,
      ]}>
      <View style={styles.prefRowLeft}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={22} color={StitchColors.primary} />
        </View>
        <View style={styles.prefRowText}>
          <Text style={styles.prefTitle}>{title}</Text>
          <Text style={styles.prefSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.prefRowRight}>
        <Text style={styles.prefValue} numberOfLines={1}>
          {value}
        </Text>
        <Ionicons name="chevron-forward" size={20} color={StitchColors.onSurfaceVariant} />
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  /** Kwadrat jak `systemSmall`: szerokość = wysokość; marginesy scroll (48) + padding ramki podglądu (56). */
  const widgetSquareSize = Math.min(240, Math.max(160, windowWidth - 104));
  const { markOnboardingIncomplete } = useAppBootstrap();
  const {
    isLoading,
    isSaving,
    profile,
    sourceLanguage,
    targetLanguage,
    currentLevel,
    displayLevelPolicy,
    displayLevel,
    canSave,
    error,
    setSourceLanguage,
    setTargetLanguage,
    setCurrentLevel,
    setDisplayLevelPolicy,
    save,
  } = useSettings();

  const { snapshot: dailySnapshot } = useDailyWord();
  const [picker, setPicker] = useState<PickerKey>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      return;
    }
    void (async () => {
      const { data } = await getSupabaseClient().auth.getUser();
      const email = data.user?.email ?? data.user?.user_metadata?.full_name;
      setAccountEmail(typeof email === 'string' ? email : null);
    })();
  }, []);

  const chipDisabled = isSaving;

  const sourceName = useMemo(
    () => supportedLanguages.find((l) => l.code === sourceLanguage)?.name ?? sourceLanguage,
    [sourceLanguage],
  );
  const targetName = useMemo(
    () => supportedLanguages.find((l) => l.code === targetLanguage)?.name ?? targetLanguage,
    [targetLanguage],
  );

  const closePicker = useCallback(() => setPicker(null), []);

  const pickerModal = useMemo(() => {
    if (!picker || !profile) {
      return null;
    }

    const title =
      picker === 'source'
        ? 'Native language'
        : picker === 'target'
          ? 'Learning language'
          : picker === 'level'
            ? 'My level (CEFR)'
            : 'Difficulty';

    return (
      <Modal visible animationType="fade" transparent onRequestClose={closePicker}>
        <Pressable style={styles.modalBackdrop} onPress={closePicker}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{title}</Text>
            <View style={styles.modalChips}>
              {picker === 'source' || picker === 'target'
                ? supportedLanguages.map((item) => (
                    <SelectionChip
                      key={item.code}
                      label={item.name}
                      active={
                        picker === 'source' ? sourceLanguage === item.code : targetLanguage === item.code
                      }
                      disabled={chipDisabled}
                      onPress={() =>
                        picker === 'source' ? setSourceLanguage(item.code) : setTargetLanguage(item.code)
                      }
                    />
                  ))
                : picker === 'level'
                  ? cefrLevels.map((level) => (
                      <SelectionChip
                        key={level}
                        label={level}
                        active={currentLevel === level}
                        disabled={chipDisabled}
                        onPress={() => setCurrentLevel(level)}
                      />
                    ))
                  : (
                      [
                        ['next-level', 'Next level'] as const,
                        ['same-level', 'Same level'] as const,
                        ['advanced-mixed', 'Advanced mixed'] as const,
                      ] as const
                    ).map(([key, label]) => (
                      <SelectionChip
                        key={key}
                        label={label}
                        active={displayLevelPolicy === key}
                        disabled={chipDisabled}
                        onPress={() => setDisplayLevelPolicy(key)}
                      />
                    ))}
            </View>
            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              style={({ pressed }) => [styles.modalDone, linkPressStyle(pressed, false)]}
              onPress={closePicker}>
              <Text style={styles.modalDoneText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }, [
    picker,
    profile,
    closePicker,
    sourceLanguage,
    targetLanguage,
    currentLevel,
    displayLevelPolicy,
    chipDisabled,
    setSourceLanguage,
    setTargetLanguage,
    setCurrentLevel,
    setDisplayLevelPolicy,
  ]);

  const widgetPreview = useMemo(() => {
    const w = dailySnapshot?.activeWord;
    const word = w?.sourceText ?? 'Ephemeral';
    const translation = w?.targetText ?? 'Lasting for a very short time.';
    return { word, translation };
  }, [dailySnapshot?.activeWord]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={StitchColors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <CenteredMessageCta
        variant="settings"
        title="Onboarding required"
        subtitle="Complete onboarding to manage your settings."
        primaryLabel="Go to onboarding"
        onPrimaryPress={() => router.replace('/(onboarding)')}
      />
    );
  }

  const displayName = accountEmail ?? 'Wordly learner';
  const since = formatSince(profile.createdAt);
  const subtitle =
    since.length > 0
      ? `Learning ${targetName} from ${sourceName} · since ${since}`
      : `Learning ${targetName} from ${sourceName}`;

  return (
    <View style={styles.screen}>
      {pickerModal}
      <ScreenHeader title="Ustawienia" />
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 28 + insets.bottom }]}>
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials} numberOfLines={1} adjustsFontSizeToFit>
                {getProfileInitials(displayName)}
              </Text>
            </View>
          </View>
          <View style={styles.profileTextCol}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileSubtitle}>{subtitle}</Text>
            <View style={styles.profilePills}>
              <View style={styles.profilePill}>
                <Text style={styles.profilePillText}>CEFR {currentLevel}</Text>
              </View>
              <View style={styles.profilePill}>
                <Text style={styles.profilePillText}>Words at {displayLevel}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Learning Preferences</Text>
        <View style={styles.listGroupOuter}>
          <View style={styles.listGroupInner}>
            <StitchSettingsRow
              icon="language-outline"
              title="Native Language"
              subtitle="Used for translations and interface"
              value={sourceName}
              disabled={chipDisabled}
              onPress={() => setPicker('source')}
            />
            <StitchSettingsRow
              icon="book-outline"
              title="Learning Language"
              subtitle="The language you are mastering"
              value={targetName}
              disabled={chipDisabled}
              onPress={() => setPicker('target')}
            />
            <StitchSettingsRow
              icon="stats-chart-outline"
              title="My Level"
              subtitle="CEFR standard proficiency"
              value={CEFR_ROW_LABEL[currentLevel]}
              disabled={chipDisabled}
              onPress={() => setPicker('level')}
            />
            <StitchSettingsRow
              icon="trending-up-outline"
              title="Difficulty"
              subtitle="Adapt content to your pace"
              value={POLICY_LABEL[displayLevelPolicy]}
              disabled={chipDisabled}
              onPress={() => setPicker('policy')}
            />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          android_ripple={ANDROID_RIPPLE_PRIMARY}
          style={({ pressed }) => [
            styles.primaryButton,
            (!canSave || isSaving) && styles.buttonDisabled,
            primarySolidPressStyle(pressed, !canSave || isSaving),
          ]}
          onPress={save}
          disabled={!canSave || isSaving}>
          {isSaving ? (
            <ActivityIndicator color={StitchColors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>Save settings</Text>
          )}
        </Pressable>

        <Text style={styles.sectionHeading}>Widget preview</Text>
        <View style={styles.widgetGrid}>
          <View style={styles.widgetPreviewCanvas}>
            <Text style={styles.widgetPreviewLabel}>Home screen preview</Text>
            <View style={[styles.widgetDevice, { width: widgetSquareSize, height: widgetSquareSize }]}>
              <View style={styles.widgetDecorLayer} pointerEvents="none">
                <View style={styles.widgetDecorBlobTop} />
                <View style={styles.widgetDecorBlobBottom} />
              </View>
              <View style={styles.widgetStack}>
                <Text style={styles.widgetBrand}>Wordly</Text>
                <Text style={styles.widgetWord} numberOfLines={3}>
                  {widgetPreview.word}
                </Text>
                <Text
                  style={styles.widgetTranslation}
                  numberOfLines={4}
                  {...Platform.select({
                    ios: { adjustsFontSizeToFit: true, minimumFontScale: 0.88 },
                    default: {},
                  })}
                >
                  {widgetPreview.translation}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.widgetNote}>
            <Text style={styles.widgetNoteText}>
              The home screen widget updates when you save settings and reflects your current daily word when
              available.
            </Text>
          </View>
        </View>

        <Text style={styles.accountHeading}>Account Management</Text>
        <View style={styles.accountCard}>
          {hasSupabaseEnv() ? (
            <Pressable
              style={({ pressed }) => [styles.accountRow, pressed && styles.accountRowPressed]}
              disabled={chipDisabled}
              onPress={() => {
                Alert.alert(
                  'Wyloguj się',
                  'Zakończysz sesję na tym urządzeniu. Profil lokalny zostanie zachowany. Po ponownym logowaniu odzyskasz postęp.',
                  [
                    { text: 'Anuluj', style: 'cancel' },
                    {
                      text: 'Wyloguj',
                      style: 'destructive',
                      onPress: () => {
                        void (async () => {
                          await signOutApp();
                          router.replace('/(onboarding)');
                        })();
                      },
                    },
                  ],
                );
              }}>
              <View style={styles.accountRowLeft}>
                <Ionicons name="log-out-outline" size={22} color={StitchColors.error} />
                <Text style={styles.accountRowLabel}>Sign out</Text>
              </View>
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.accountRow, pressed && styles.accountRowPressed]}
            onPress={() =>
              Alert.alert(
                'Delete account',
                'Account deletion is not available in the app yet. Contact support if you need to remove your data.',
              )
            }>
            <View style={styles.accountRowLeft}>
              <Ionicons name="trash-outline" size={22} color={StitchColors.error} />
              <Text style={[styles.accountRowLabel, styles.accountRowDanger]}>Delete account</Text>
            </View>
          </Pressable>
        </View>

        {__DEV__ ? (
          <View style={styles.devBlock}>
            <Text style={styles.devLabel}>Developer</Text>
            <Pressable
              style={styles.devButton}
              onPress={() => {
                Alert.alert(
                  'Reset onboarding',
                  'Clears the onboarding flag and opens the language step. For testing only.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset',
                      onPress: () => {
                        void (async () => {
                          await clearOnboardingCompletionFlag();
                          markOnboardingIncomplete();
                          router.replace('/(onboarding)/language-pair');
                        })();
                      },
                    },
                  ],
                );
              }}>
              <Text style={styles.devButtonText}>Reset onboarding (test)</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: StitchColors.surface,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
    backgroundColor: StitchColors.surface,
  },
  profileCard: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    padding: 28,
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLow,
  },
  avatarWrap: {
    alignSelf: 'center',
  },
  /** Jeden widok = jedno kółko (bez zagnieżdżonego kwadratu z tłem pod `overflow`). */
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: StitchColors.primaryContainer,
    borderWidth: 3,
    borderColor: 'rgba(133, 150, 255, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 30,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onPrimaryContainer,
    letterSpacing: 0.5,
    textAlign: 'center',
    includeFontPadding: false,
  },
  profileTextCol: {
    width: '100%',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 20,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    marginBottom: 4,
    textAlign: 'center',
  },
  profileSubtitle: {
    fontSize: 14,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  profilePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  profilePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainerLowest,
  },
  profilePillText: {
    fontSize: 11,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurfaceVariant,
  },
  sectionHeading: {
    fontSize: 17,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    paddingHorizontal: 4,
    marginBottom: -8,
  },
  listGroupOuter: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerHigh,
    padding: 1,
    overflow: 'hidden',
    shadowColor: StitchColors.onSurface,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  listGroupInner: {
    gap: 1,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: StitchColors.surfaceContainerLowest,
  },
  prefRowPressed: {
    backgroundColor: StitchColors.surfaceContainerLow,
  },
  prefRowDisabled: {
    opacity: 0.45,
  },
  prefRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(68, 86, 186, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefRowText: {
    flex: 1,
    minWidth: 0,
  },
  prefTitle: {
    fontSize: 14,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
    marginBottom: 2,
  },
  prefSubtitle: {
    fontSize: 12,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    lineHeight: 16,
  },
  prefRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '42%',
  },
  prefValue: {
    fontSize: 13,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
    textAlign: 'right',
    flexShrink: 1,
  },
  error: {
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.error,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.xl,
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
    shadowColor: StitchColors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  primaryButtonText: {
    color: StitchColors.onPrimary,
    fontFamily: StitchFonts.bodySemi,
    fontSize: 17,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  widgetGrid: {
    gap: 16,
  },
  widgetPreviewCanvas: {
    borderRadius: StitchRadius.lg,
    borderWidth: 2,
    borderColor: 'rgba(175, 179, 179, 0.35)',
    backgroundColor: StitchColors.surfaceContainerLow,
    padding: 28,
    alignItems: 'center',
  },
  widgetPreviewLabel: {
    fontSize: 10,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  /**
   * Jak `WordlyDailyWidget.swift`: marka → duże słowo → mniejsze tłumaczenie (drugi plan).
   */
  widgetDevice: {
    alignSelf: 'center',
    borderRadius: StitchRadius.xl,
    padding: 0,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    overflow: 'hidden',
    backgroundColor: widgetIosBackground,
  },
  /** Jedna warstwa zbliżona do Swift: gradient do tła, bez wyraźnej „wewnętrznej karty”. */
  widgetDecorLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: StitchRadius.xl,
    overflow: 'hidden',
  },
  widgetDecorBlobTop: {
    position: 'absolute',
    top: -20,
    right: -16,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(68, 86, 186, 0.10)',
  },
  widgetDecorBlobBottom: {
    position: 'absolute',
    bottom: -32,
    left: -24,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(68, 86, 186, 0.03)',
  },
  /** Zgodne z `WordlyWidgetContentPadding.small` (16). */
  widgetStack: {
    width: '100%',
    alignItems: 'flex-start',
    zIndex: 1,
    padding: 16,
  },
  widgetBrand: {
    fontSize: 11,
    lineHeight: 14,
    color: StitchColors.primary,
    letterSpacing: 0.35,
    opacity: 0.9,
    marginBottom: 8,
    ...Platform.select({
      ios: { fontWeight: '600' as const },
      default: { fontFamily: StitchFonts.bodySemi },
    }),
  },
  widgetWord: {
    fontSize: 26,
    lineHeight: 30,
    color: widgetIosLabel,
    ...Platform.select({
      ios: { fontWeight: '700' as const },
      default: { fontFamily: StitchFonts.headline },
    }),
  },
  widgetTranslation: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: widgetIosSecondaryLabel,
    ...Platform.select({
      ios: { fontWeight: '400' as const },
      default: { fontFamily: StitchFonts.body },
    }),
  },
  widgetNote: {
    paddingHorizontal: 4,
  },
  widgetNoteText: {
    fontSize: 13,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    lineHeight: 20,
  },
  accountHeading: {
    fontSize: 17,
    fontFamily: StitchFonts.headline,
    color: StitchColors.error,
    paddingHorizontal: 4,
    marginBottom: -8,
  },
  accountCard: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLow,
    padding: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  accountRow: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: StitchRadius.md,
  },
  accountRowPressed: {
    backgroundColor: 'rgba(249, 115, 134, 0.12)',
  },
  accountRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  accountRowLabel: {
    fontSize: 14,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
  },
  accountRowDanger: {
    color: StitchColors.error,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 20, 25, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    padding: 22,
    gap: 18,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
  },
  modalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalDone: {
    alignSelf: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  modalDoneText: {
    fontSize: 16,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
  },
  devBlock: {
    marginTop: 8,
    paddingVertical: 16,
    paddingHorizontal: 4,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: StitchColors.surfaceContainerHigh,
  },
  devLabel: {
    fontSize: 11,
    fontFamily: StitchFonts.label,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  devButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: StitchRadius.sm,
    backgroundColor: StitchColors.surfaceContainer,
  },
  devButtonText: {
    fontSize: 14,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
  },
});
