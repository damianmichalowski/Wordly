import { useIsRestoring } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CenteredMessageCta } from '@/src/components/ui/CenteredMessageCta';
import { KnownWordsList } from '@/src/features/library/components/KnownWordsList';
import { useLibraryScreenData } from '@/src/features/library/hooks/useLibraryScreenData';
import { StitchColors } from '@/src/theme/wordlyStitchTheme';
import { logUserAction } from '@/src/utils/userActionLog';

export default function LibraryTabScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isRestoringCache = useIsRestoring();
  const {
    viewKind,
    libraryListHydrating,
    libraryUnlockEmptyConfirmed,
    libraryDisplayKnownCount,
    libraryLoadError,
    libraryRefreshing,
    knownWords,
    sortPrefs,
    setRevisionSortPrefs,
    overviewData,
    overviewLoading,
    selectedCollection,
    setSelectedCollection,
    searchQuery,
    setSearchQuery,
    selectedTiers,
    setSelectedTiers,
    hasActiveFilters,
  } = useLibraryScreenData();

  switch (viewKind) {
    case 'onboarding_required':
      return (
        <SafeAreaView
          style={{ flex: 1, backgroundColor: StitchColors.surface }}
          edges={['top', 'bottom']}
        >
          <CenteredMessageCta
            variant="home"
            title={t('library.onboardingRequiredTitle')}
            subtitle={t('library.onboardingRequiredSubtitle')}
            primaryLabel={t('library.goToOnboarding')}
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
      headerTitle={t('library.screenTitle')}
      listHydrating={isRestoringCache || libraryListHydrating}
      effectiveKnownCount={libraryDisplayKnownCount}
      suppressGenericEmptyMessage
      libraryLoadError={libraryLoadError}
      overviewData={overviewData}
      overviewLoading={overviewLoading}
      selectedCollection={selectedCollection}
      onCollectionChange={setSelectedCollection}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      selectedTiers={selectedTiers}
      onSelectedTiersChange={setSelectedTiers}
      hasActiveFilters={hasActiveFilters}
      refreshing={libraryRefreshing}
    />
  );
}
