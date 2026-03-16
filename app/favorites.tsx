// Placeholder — will be fully implemented in Step 13.
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '@/store/useStore';
import { darkColors, lightColors } from '@/config/theme';

export default function FavoritesScreen() {
  const { isDarkMode } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;
  return (
    <View style={[styles.container, { backgroundColor: colors.base }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={[styles.backText, { color: colors.accent }]}>← Back</Text>
      </TouchableOpacity>
      <Text style={[styles.text, { color: colors.textPrimary }]}>Favorites — Step 13</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  back: { position: 'absolute', top: 60, left: 24 },
  backText: { fontFamily: 'Mukta_400Regular', fontSize: 15 },
  text: { fontFamily: 'Mukta_400Regular', fontSize: 16 },
});
