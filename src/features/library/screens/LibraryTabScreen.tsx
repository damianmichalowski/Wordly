import { useIsRestoring } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CenteredMessageCta } from '@/src/components/ui/CenteredMessageCta';
import { TransportRetryMessage } from '@/src/components/ui/TransportRetryMessage';
import { KnownWordsList } from '@/src/features/library/components/KnownWordsList';
import { useLibraryScreenData } from '@/src/features/library/hooks/useLibraryScreenData';
import { StitchColors } from '@/src/theme/wordlyStitchTheme';
import { logUserAction } from '@/src/utils/userActionLog';

/**
 * Zakładka Biblioteka (tab `app/(tabs)/library`): lista znanych słów, wyszukiwarka i filtry.
 * Lista i filtry: `useLibraryScreenData` (osobno od sesji powtórki w `useRevisionHubSession`).
 */
export default function LibraryTabScreen() {
  const router = useRouter();
  const isRestoringCache = useIsRestoring();
  const {
    viewKind,
    settingsResolved,
    settingsRetryBusy,
    libraryListHydrating,
    libraryUnlockEmptyConfirmed,
    libraryDisplayKnownCount,
    libraryLoadError,
    libraryFetchBusy,
    knownWords,
    sortPrefs,
    setRevisionSortPrefs,
    refresh,
  } = useLibraryScreenData();

  switch (viewKind) {
    case 'settings_transport_error':
      return (
        <SafeAreaView
          style={{ flex: 1, backgroundColor: StitchColors.surface }}
          edges={['top', 'bottom']}
        >
          <TransportRetryMessage
            variant="screen"
            isRetrying={settingsRetryBusy}
            onRetry={() => {
              logUserAction('button_press', {
                target: 'library_settings_fetch_retry',
              });
              void refresh();
            }}
          />
        </SafeAreaView>
      );

    case 'onboarding_required':
      return (
        <SafeAreaView
          style={{ flex: 1, backgroundColor: StitchColors.surface }}
          edges={['top', 'bottom']}
        >
          <CenteredMessageCta
            variant="home"
            title="Wymagany onboarding"
            subtitle="Ukończ onboarding, aby przeglądać bibliotekę."
            primaryLabel="Przejdź do onboardingu"
            onPrimaryPress={() => {
              logUserAction('button_press', {
                target: 'library_onboarding_required',
              });
              router.replace('/(onboarding)');
            }}
          />
        </SafeAreaView>
      );

    case 'library_content':
      break;
  }

  return (
    <KnownWordsList
      knownWords={knownWords}
      sortPrefs={sortPrefs}
      onSortPrefsChange={setRevisionSortPrefs}
      onOpenWord={(w) => {
        logUserAction('tile_press', { target: 'library_word_row', wordId: w.id });
        router.push(`/word/${w.id}?from=library`);
      }}
      showUnlockEmptyState={libraryUnlockEmptyConfirmed}
      onUnlockPrimaryPress={() => router.push('/(tabs)/home')}
      headerTitle="Biblioteka"
      listHydrating={
        isRestoringCache || !settingsResolved || libraryListHydrating
      }
      effectiveKnownCount={libraryDisplayKnownCount}
      suppressGenericEmptyMessage
      libraryLoadError={libraryLoadError}
      libraryFetchBusy={libraryFetchBusy}
      onRetryLibrary={() => {
        void refresh();
      }}
    />
  );
}
