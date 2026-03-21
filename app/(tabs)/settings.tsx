import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { supportedLanguages } from '@/src/constants/languages';
import { useSettings } from '@/src/features/settings/useSettings';
import { cefrLevels } from '@/src/types/cefr';
export default function SettingsScreen() {
  const router = useRouter();
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

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color="#111827" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Onboarding required</Text>
        <Text style={styles.subtitle}>Complete onboarding to manage your settings.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/(onboarding)')}>
          <Text style={styles.primaryButtonText}>Go to onboarding</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Change learning profile and difficulty preferences.</Text>

      <Text style={styles.sectionTitle}>Source language</Text>
      <View style={styles.chips}>
        {supportedLanguages.map((item) => (
          <Chip
            key={`source-${item.code}`}
            label={item.name}
            active={sourceLanguage === item.code}
            onPress={() => setSourceLanguage(item.code)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Target language</Text>
      <View style={styles.chips}>
        {supportedLanguages.map((item) => (
          <Chip
            key={`target-${item.code}`}
            label={item.name}
            active={targetLanguage === item.code}
            onPress={() => setTargetLanguage(item.code)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Current level</Text>
      <View style={styles.chips}>
        {cefrLevels.map((level) => (
          <Chip
            key={`level-${level}`}
            label={level}
            active={currentLevel === level}
            onPress={() => setCurrentLevel(level)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Shown difficulty policy</Text>
      <View style={styles.chips}>
        <Chip
          label="Next level"
          active={displayLevelPolicy === 'next-level'}
          onPress={() => setDisplayLevelPolicy('next-level')}
        />
        <Chip
          label="Same level"
          active={displayLevelPolicy === 'same-level'}
          onPress={() => setDisplayLevelPolicy('same-level')}
        />
        <Chip
          label="Advanced mixed"
          active={displayLevelPolicy === 'advanced-mixed'}
          onPress={() => setDisplayLevelPolicy('advanced-mixed')}
        />
      </View>

      <Text style={styles.meta}>Computed display level: {displayLevel}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.primaryButton, (!canSave || isSaving) && styles.buttonDisabled]}
        onPress={save}
        disabled={!canSave || isSaving}>
        <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Save settings'}</Text>
      </Pressable>
    </View>
  );
}

type ChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function Chip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 20,
    gap: 10,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
  },
  sectionTitle: {
    marginTop: 8,
    color: '#374151',
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  chipActive: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  chipText: {
    color: '#111827',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#f9fafb',
  },
  meta: {
    marginTop: 8,
    color: '#6b7280',
  },
  error: {
    color: '#b45309',
  },
  primaryButton: {
    marginTop: 'auto',
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#f9fafb',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
