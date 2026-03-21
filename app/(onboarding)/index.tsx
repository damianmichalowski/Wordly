import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Wordly</Text>
      <Text style={styles.subtitle}>
        Build your daily word flow by choosing language pair and your current level.
      </Text>
      <Pressable style={styles.button} onPress={() => router.push('/(onboarding)/language-pair')}>
        <Text style={styles.buttonText}>Start Onboarding</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  buttonText: {
    color: '#f9fafb',
    fontWeight: '600',
  },
});
