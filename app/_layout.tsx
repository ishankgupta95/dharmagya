import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { AppState, useColorScheme, type AppStateStatus } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Fraunces_300Light,
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_300Light_Italic,
  Fraunces_400Regular_Italic,
} from '@expo-google-fonts/fraunces';
import {
  NotoSerifDevanagari_400Regular,
  NotoSerifDevanagari_500Medium,
  NotoSerifDevanagari_700Bold,
} from '@expo-google-fonts/noto-serif-devanagari';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors } from '@/config/theme';
import { initDatabase } from '@/utils/database';
import i18n, { resolveLanguage, changeLanguage } from '@/i18n';
import { preloadInterstitial, showInterstitial } from '@/services/interstitialAds';
import { scheduleDailyReminder } from '@/services/notifications';
import { rescheduleReminders, hasAnyReminderEnabled } from '@/services/reminderScheduler';
import { refreshTodayWidget } from '@/services/widgets/widgetRefresh';
import { APP_RESUME_MIN_BACKGROUND_MS } from '@/config/ads';
import { pmark } from '@/utils/perfProfile';

pmark('app:_layout:moduleEval');

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  pmark('app:RootLayout:render');
  const {
    isDarkMode,
    themeMode,
    setResolvedDarkMode,
    hasOnboarded,
    language,
    initFirstOpen,
    dailyReminderEnabled,
    dailyReminderTime,
    reminderPrefs,
    tithiReminderTime,
    festivalReminderTime,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
  } = useStore();
  const systemScheme = useColorScheme();
  // Resolve themeMode + system scheme into isDarkMode. useColorScheme already
  // re-renders on Appearance changes, so this stays in sync without a manual
  // listener.
  useEffect(() => {
    const resolved =
      themeMode === 'system' ? systemScheme !== 'light' : themeMode === 'dark';
    setResolvedDarkMode(resolved);
  }, [themeMode, systemScheme, setResolvedDarkMode]);
  const quietHours = useMemo(
    () => ({ enabled: quietHoursEnabled, startHHmm: quietHoursStart, endHHmm: quietHoursEnd }),
    [quietHoursEnabled, quietHoursStart, quietHoursEnd],
  );
  const [storeHydrated, setStoreHydrated] = useState(
    () => useStore.persist.hasHydrated()
  );

  const [fontsLoaded, fontError] = useFonts({
    // Sacred Editorial — Fraunces (display + body serif, italic pairs).
    Fraunces_300Light,
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_300Light_Italic,
    Fraunces_400Regular_Italic,
    // Sacred Editorial — Noto Serif Devanagari (hi-titles, mantras).
    NotoSerifDevanagari_400Regular,
    NotoSerifDevanagari_500Medium,
    NotoSerifDevanagari_700Bold,
  });

  // Wait for Zustand persistence to rehydrate from AsyncStorage
  useEffect(() => {
    if (storeHydrated) {
      pmark('app:zustand:alreadyHydrated');
      return;
    }
    return useStore.persist.onFinishHydration(() => {
      pmark('app:zustand:hydrated');
      setStoreHydrated(true);
    });
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
    if (fontsLoaded) pmark('app:fonts:loaded');
    else if (fontError) pmark('app:fonts:error');
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (appReady) {
      pmark('app:appReady');
      initFirstOpen();
      pmark('app:splash:hide:call');
      SplashScreen.hideAsync();
      // Cold-start widget refresh — covers the case where the user tapped
      // the widget to launch the app and we want fresh values written back
      // before they ever look at the home screen again.
      void refreshTodayWidget();
    }
  }, [appReady, initFirstOpen]);

  // In-app changes that affect widget rendering (theme, language) need to
  // bypass the foreground-refresh debounce so the widget repaints immediately
  // when the user toggles a setting and tabs to home.
  useEffect(() => {
    if (!appReady) return;
    void refreshTodayWidget({ force: true });
  }, [appReady, isDarkMode, language]);

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
        // Roll the daily-reminder 14-day horizon forward so tomorrow's vrat
        // stays accurate. Safe no-op when disabled.
        if (dailyReminderEnabled) {
          void scheduleDailyReminder(dailyReminderTime, quietHours);
        }
        // Roll the reminder horizon (next 30 days of tithi + festival reminders).
        if (hasAnyReminderEnabled(reminderPrefs)) {
          void rescheduleReminders(
            reminderPrefs,
            { tithi: tithiReminderTime, festival: festivalReminderTime },
            quietHours,
          );
        }
        // Foreground refresh of the home-screen widget. Debounced inside the
        // service so multiple resumes per minute don't recompute panchang.
        void refreshTodayWidget();
      }
    });
    return () => sub.remove();
  }, [appReady, hasOnboarded, dailyReminderEnabled, dailyReminderTime, reminderPrefs, tithiReminderTime, festivalReminderTime, quietHours]);

  // Roll reminder horizons once on each cold start too.
  useEffect(() => {
    if (!appReady || !hasOnboarded) return;
    if (dailyReminderEnabled) void scheduleDailyReminder(dailyReminderTime, quietHours);
    if (hasAnyReminderEnabled(reminderPrefs)) {
      void rescheduleReminders(
        reminderPrefs,
        { tithi: tithiReminderTime, festival: festivalReminderTime },
        quietHours,
      );
    }
  }, [appReady, hasOnboarded, dailyReminderEnabled, dailyReminderTime, reminderPrefs, tithiReminderTime, festivalReminderTime, quietHours]);

  if (!appReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
              {/* Settings sub-screens slide up as modals (P11.6). They're
                  short-lived configuration sheets — modal presentation matches
                  the user mental model better than the default deep-link push. */}
              <Stack.Screen
                name="settings/birth-place"
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="settings/deities"
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="settings/reminders"
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
              {/* Search swaps in/out as a content overlay rather than a push,
                  so a fade reads more "search dialog" than "drilldown". */}
              <Stack.Screen name="search" options={{ animation: 'fade' }} />
            </Stack>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />
          </SQLiteProvider>
        </Suspense>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
