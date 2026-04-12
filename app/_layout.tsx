import { useEffect, useRef, useState, Suspense } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import {
  useFonts,
  Mukta_400Regular,
  Mukta_500Medium,
  Mukta_700Bold,
} from '@expo-google-fonts/mukta';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors } from '@/config/theme';
import { initDatabase } from '@/utils/database';
import i18n, { resolveLanguage, changeLanguage } from '@/i18n';
import { preloadInterstitial, showInterstitial } from '@/services/interstitialAds';
import { APP_RESUME_MIN_BACKGROUND_MS } from '@/config/ads';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isDarkMode, hasOnboarded, language, initFirstOpen } = useStore();
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
      if (i18n.language !== resolved) changeLanguage(resolved);
    }
  }, [language, storeHydrated]);

  const appReady = (fontsLoaded || !!fontError) && storeHydrated;

  useEffect(() => {
    if (appReady) {
      initFirstOpen();
      SplashScreen.hideAsync();
    }
  }, [appReady, initFirstOpen]);

  useEffect(() => {
    if (appReady && !hasOnboarded) {
      router.replace('/onboarding/step1');
    }
  }, [appReady, hasOnboarded]);

  // ── App resume interstitial ───────────────────────────────────────────────
  const backgroundTimestampRef = useRef(0);

  useEffect(() => {
    if (!appReady || !hasOnboarded) return;

    preloadInterstitial('appResume');

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        backgroundTimestampRef.current = Date.now();
      } else if (state === 'active' && backgroundTimestampRef.current > 0) {
        const elapsed = Date.now() - backgroundTimestampRef.current;
        backgroundTimestampRef.current = 0;
        if (elapsed >= APP_RESUME_MIN_BACKGROUND_MS) {
          showInterstitial('appResume');
        }
      }
    });
    return () => sub.remove();
  }, [appReady, hasOnboarded]);

  if (!appReady) return null;

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
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
    </SafeAreaProvider>
  );
}
