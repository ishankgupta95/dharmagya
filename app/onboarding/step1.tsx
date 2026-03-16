// Placeholder — will be fully implemented in Step 14.
// Immediately marks onboarding complete so the app is testable during Steps 5–13.
import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '@/store/useStore';
import { darkColors } from '@/config/theme';

export default function OnboardingStep1() {
  const { setHasOnboarded } = useStore();

  function handleContinue() {
    setHasOnboarded();
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>dharmSetu</Text>
      <Text style={styles.subtitle}>Onboarding — Step 14</Text>
      <TouchableOpacity style={styles.button} onPress={handleContinue}>
        <Text style={styles.buttonText}>Enter App</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkColors.base,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontFamily: 'Mukta_700Bold',
    fontSize: 28,
    color: darkColors.textPrimary,
  },
  subtitle: {
    fontFamily: 'Mukta_400Regular',
    fontSize: 14,
    color: darkColors.textMuted,
  },
  button: {
    marginTop: 24,
    backgroundColor: darkColors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  buttonText: {
    fontFamily: 'Mukta_500Medium',
    fontSize: 15,
    color: darkColors.base,
  },
});
