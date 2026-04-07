import { useEffect, useState, Suspense } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import {
  useFonts,
  Mukta_400Regular,
  Mukta_500Medium,
  Mukta_700Bold,
} from '@expo-google-fonts/mukta';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors } from '@/config/theme';
import { initDatabase } from '@/utils/database';
import i18n, { resolveLanguage } from '@/i18n';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isDarkMode, hasOnboarded, language } = useStore();
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

  // Sync i18n language whenever the persisted preference changes
  useEffect(() => {
    if (storeHydrated) {
      const resolved = resolveLanguage(language);
      if (i18n.language !== resolved) i18n.changeLanguage(resolved);
    }
  }, [language, storeHydrated]);

  const appReady = (fontsLoaded || !!fontError) && storeHydrated;

  useEffect(() => {
    if (appReady) {
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
      <SQLiteProvider databaseName="dharmagya.db" useSuspense onInit={initDatabase}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: isDarkMode ? darkColors.base : lightColors.base },
            animation: 'slide_from_right',
          }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      </SQLiteProvider>
    </Suspense>
  );
}
