import { useEffect, useState, Suspense } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { PaperProvider } from 'react-native-paper';
import { SQLiteProvider } from 'expo-sqlite';
import {
  useFonts,
  Mukta_400Regular,
  Mukta_500Medium,
  Mukta_700Bold,
} from '@expo-google-fonts/mukta';

import { useStore } from '@/store/useStore';
import { darkTheme, lightTheme } from '@/config/theme';
import { initDatabase } from '@/utils/database';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const { isDarkMode, hasOnboarded } = useStore();
  const [storeHydrated, setStoreHydrated] = useState(
    () => useStore.persist.hasHydrated()
  );

  const [fontsLoaded, fontError] = useFonts({
    Mukta_400Regular,
    Mukta_500Medium,
    Mukta_700Bold,
  });

  // Wait for Zustand persistence to rehydrate from AsyncStorage
  useEffect(() => {
    if (storeHydrated) return;
    return useStore.persist.onFinishHydration(() => setStoreHydrated(true));
  }, [storeHydrated]);

  const appReady = (fontsLoaded || !!fontError) && storeHydrated;

  useEffect(() => {
    if (appReady) {
      initDatabase();
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  useEffect(() => {
    if (appReady && !hasOnboarded) {
      router.replace('/onboarding/step1');
    }
  }, [appReady, hasOnboarded]);

  if (!appReady) return null;

  return (
    <Suspense fallback={null}>
      <SQLiteProvider databaseName="dharmsetu.db" useSuspense>
        <PaperProvider theme={isDarkMode ? darkTheme : lightTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
          </Stack>
          <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        </PaperProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
