import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  Suspense,
} from 'react';
import {
  AppState,
  Appearance,
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type AppStateStatus,
} from 'react-native';
import { Stack, router, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// Fonts are NOT loaded here on Android. All 7 faces (Geist 200–600,
// NotoSerifDevanagari 500–600) are embedded natively by the `expo-font` config
// plugin in app.json, which copies each TTF into
// `android/app/src/main/assets/fonts/` under its own basename. React Native's
// ReactFontManager resolves `fontFamily` against exactly that basename, so the
// family strings in `theme.ts` typeScale (`Geist_400Regular`,
// `NotoSerifDevanagari_500Medium`, …) keep resolving. Importing the font
// modules here would make metro emit the same TTFs into `res/raw` a second
// time — do not add them back.
//
// iOS is the exception: nothing is embedded there, so `useAppFonts` (the
// platform-split `@/config/fontGate`) loads the same 7 files at runtime under
// the same family strings. On Android and web it is a constant `true`.

import {
  useStore,
  storeHydration,
  type Ayanamsa,
  type MasaSystem,
  type ReminderPrefs,
} from '@/store/useStore';
import { darkColors, lightColors } from '@/config/theme';
import { useAppFonts } from '@/config/fontGate';
import { initDatabase } from '@/utils/database';
import i18n, { resolveLanguage, changeLanguage } from '@/i18n';
import { preloadInterstitial, showInterstitial } from '@/services/interstitialAds';
import {
  beginSchedulePass,
  scheduleDailyReminder,
  scheduleSunriseAlert,
  type QuietHours,
} from '@/services/notifications';
import { FALLBACK_COORDS } from '@/services/astrology/panchangService';
import { rescheduleReminders, hasAnyReminderEnabled } from '@/services/reminderScheduler';
import { refreshTodayWidget } from '@/services/widgets/widgetRefresh';
// Not `@/config/ads`: that module does a top-level
// `require('react-native-google-mobile-ads')`, which drags ~40 modules and 8
// synchronous `TurboModuleRegistry.getEnforcing` calls onto the cold-start path
// for one integer. `adTiming` is plain numbers with no imports.
import { APP_RESUME_MIN_BACKGROUND_MS } from '@/config/adTiming';
import { pmark } from '@/utils/perfProfile';
// In-app toast for iOS (reader copy confirmations); renders nothing on
// Android, where `showToast` uses ToastAndroid.
import { ToastHost } from '@/components/common/Toast';

pmark('app:_layout:moduleEval');

SplashScreen.preventAutoHideAsync();

// ─── Reminder horizons ───────────────────────────────────────────────────────

interface ReminderHorizonArgs {
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  sunriseAlertEnabled: boolean;
  sunriseAlertOffsetMin: number;
  reminderPrefs: ReminderPrefs;
  tithiReminderTime: string;
  festivalReminderTime: string;
  quietHours: QuietHours;
  coords: { lat: number; lon: number } | null;
  ayanamsa: Ayanamsa;
  masaSystem: MasaSystem;
}

/**
 * Roll all three notification horizons under ONE read of the OS queue.
 *
 * Each scheduler used to open with its own `getAllScheduledNotificationsAsync`
 * and then cancel-and-rewrite everything it owns, so a plain resume cost ~3
 * getAll + ~50 cancels + ~48 schedules of serially-awaited native round trips
 * to arrive at a queue byte-identical to the one it started with. The shared
 * `SchedulePass` lets each of them diff by identifier instead.
 *
 * The signature is what makes that safe: identifiers encode a key and a date
 * but not the fire TIME, so anything below that moves a trigger — or re-renders
 * copy that was frozen into the queue at schedule time — has to force the old
 * rewrite path. Note `i18n.language`, not the store's `language`: 'system'
 * resolves, and the AppState listener calls this without a `language` dep.
 */
async function rollReminderHorizons(a: ReminderHorizonArgs): Promise<void> {
  const anyReminders = hasAnyReminderEnabled(a.reminderPrefs);
  if (!a.dailyReminderEnabled && !a.sunriseAlertEnabled && !anyReminders) return;

  const coords = a.coords ?? FALLBACK_COORDS;
  const signature = [
    i18n.language,
    // Region is not a prop here for the same reason `rescheduleReminders` reads
    // it off the store directly, but it DOES belong in the signature: it is the
    // one setting that rewrites copy without moving an identifier. A festival
    // reminder's id is `(category, date)` while its headline name is picked
    // from the region-FILTERED rows, so switching region can leave
    // `dharmagya-festival-major-2026-10-20` queued under the wrong festival's
    // name forever. (Its id-level effects — rows dropping in or out — the diff
    // already handles.)
    useStore.getState().region,
    a.dailyReminderTime,
    a.tithiReminderTime,
    a.festivalReminderTime,
    a.quietHours.enabled ? `${a.quietHours.startHHmm}-${a.quietHours.endHHmm}` : 'off',
    a.sunriseAlertOffsetMin,
    coords.lat,
    coords.lon,
    a.ayanamsa,
    a.masaSystem,
  ].join('|');
  const pass = (await beginSchedulePass(signature)) ?? undefined;

  // Serial on purpose: three concurrent schedulers would interleave dozens of
  // native calls on the same queue for no wall-clock win, and this whole pass
  // is already off the launch window.
  //
  // Each stage is isolated: the schedulers await `scheduleNotificationAsync`
  // with no catch of their own, and one native throw (Samsung's 500-alarm cap,
  // a permission revoked mid-pass, an invalid trigger) must not skip the other
  // horizons or escape as an unhandled rejection from the `void` call sites.
  const step = async (label: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (e) {
      console.warn(`[reminders] ${label} horizon failed`, e);
    }
  };
  if (a.dailyReminderEnabled) {
    await step('daily', () => scheduleDailyReminder(a.dailyReminderTime, a.quietHours, pass));
  }
  if (a.sunriseAlertEnabled) {
    await step('sunrise', () => scheduleSunriseAlert(coords, a.sunriseAlertOffsetMin, pass));
  }
  if (anyReminders) {
    await step('tithi/festival', () =>
      rescheduleReminders(
        a.reminderPrefs,
        { tithi: a.tithiReminderTime, festival: a.festivalReminderTime },
        a.quietHours,
        { coords: a.coords, ayanamsa: a.ayanamsa, masaSystem: a.masaSystem },
        pass,
      ),
    );
  }
}

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
    userLocation,
    ayanamsa,
    masaSystem,
    sunriseAlertEnabled,
    sunriseAlertOffsetMin,
    useDevanagariNumerals,
    region,
    locationName,
  } = useStore();
  const systemScheme = useColorScheme();

  // ── Store hydration ───────────────────────────────────────────────────────
  // The persisted store is read from expo-sqlite/kv-store asynchronously, so
  // the first commit runs on DEFAULTS: hasOnboarded false, dark theme, no
  // birth details. Three flags hang off knowing when that read has landed.
  //
  //   · `hydrationSettled` — the read finished, successfully or not, as
  //     reported by the store's `onRehydrateStorage` callback and read here
  //     through `useSyncExternalStore` (React-Compiler safe: no ref read in
  //     render, no setState in an effect, and no render→commit gap in which a
  //     one-shot subscription could miss the event). A REJECTED hydrate —
  //     SQLITE_FULL, corrupt persisted JSON — settles too. That is the case
  //     `persist.onFinishHydration` cannot see: zustand swallows the
  //     rejection and never fires it, `hasHydrated` stays false forever, this
  //     component returns null, and the gated `hideAsync()` below never runs.
  //     The result is a permanent native splash: not a crash, so Play Vitals
  //     shows nothing, and the only user escape is clear-data, which in this
  //     offline app destroys the birth chart, favourites and jaap history for
  //     good. On failure we proceed on defaults straight away.
  //   · `watchdogFired` — the read has neither succeeded nor failed after 4s.
  //     Either storage is hung, for which this is the only exit, or merely
  //     SLOW, which nothing can tell apart. So the watchdog is a fallback,
  //     not the hydration signal: the subscription stays live after it fires
  //     and a late hydrate is still observed (the old effect unsubscribed the
  //     moment it flipped `storeHydrated`, so a late success was never seen).
  //   · `storeHydrated` — either of the above; what releases the splash.
  //
  // What a late hydrate after the watchdog has to undo: `appReady` flipped on
  // the default store, `hasOnboarded` was false, so both the effect further
  // down and the declarative <Redirect> in (tabs)/_layout.tsx sent the user
  // into onboarding. When the real state lands `hasOnboarded` flips true in
  // memory, but nothing navigates back on its own — the only exit from
  // onboarding is handleFinish() in onboarding/birth.tsx — so the effect below
  // does, mirroring handleFinish. Meanwhile the store's own storage gate
  // guarantees nothing `set` while it held defaults reached disk, so a user
  // who force-quits from the surprise onboarding does not relaunch as a fresh
  // install; and `initFirstOpen` waits for a real settle rather than stamping
  // the default store.
  const hydration = useSyncExternalStore(
    storeHydration.subscribe,
    storeHydration.outcome,
    storeHydration.outcome,
  );
  const hydrationSettled = hydration !== null;
  const [watchdogFired, setWatchdogFired] = useState(false);
  const storeHydrated = hydrationSettled || watchdogFired;

  useEffect(() => {
    if (!hydration) return;
    if (hydration.ok) {
      pmark('app:zustand:hydrated');
    } else {
      pmark('app:zustand:hydrateFailed');
      console.warn('[store] rehydration failed — continuing on defaults', hydration.error);
    }
  }, [hydration]);

  useEffect(() => {
    if (hydrationSettled) return;
    const watchdog = setTimeout(() => {
      pmark('app:zustand:hydrateTimeout');
      console.warn('[store] rehydration did not settle in 4s — continuing on defaults');
      setWatchdogFired(true);
    }, 4000);
    return () => clearTimeout(watchdog);
  }, [hydrationSettled]);

  // Late hydrate after the watchdog: undo the forced onboarding. Reads
  // `getState()` rather than the subscribed `hasOnboarded` so this runs once,
  // when hydration lands, and not again when the user finishes onboarding for
  // real (handleFinish already navigates then). If the read happened to land
  // in the same commit the watchdog rendered, the user is already on (tabs)
  // and the replace is a harmless no-op; `dismissAll` is POP_TO_TOP, a no-op
  // on a single-route stack.
  useEffect(() => {
    if (!watchdogFired || !hydrationSettled) return;
    if (!useStore.getState().hasOnboarded) return;
    router.dismissAll();
    router.replace('/(tabs)');
  }, [watchdogFired, hydrationSettled]);

  // Resolve themeMode + system scheme into isDarkMode. useColorScheme already
  // re-renders on Appearance changes, so this stays in sync without a manual
  // listener. Gated until the store has settled (or the watchdog gave up) so
  // the first commit does not `set` — and so write — against the default
  // store; that first-commit write was the confirmed path by which a real
  // user's blob got replaced with defaults (see the gate note in useStore.ts).
  // Both flags are deps so it re-runs the moment real state lands, which also
  // covers the OS scheme having changed while the app was closed: persisted
  // `isDarkMode` is stale then, and `themeMode` alone would not re-trigger.
  // On Android, `systemScheme` is the in-app override while one is set (see
  // the next effect). That is harmless: it is only read when `themeMode` is
  // 'system', and then the override is cleared, so it is the OS value again.
  // Switching from a forced theme back to 'system' can hold the old scheme
  // until the native `appearanceChanged` event lands a moment later.
  useEffect(() => {
    if (!hydrationSettled && !watchdogFired) return;
    const resolved =
      themeMode === 'system' ? systemScheme !== 'light' : themeMode === 'dark';
    setResolvedDarkMode(resolved);
  }, [themeMode, systemScheme, hydrationSettled, watchdogFired, setResolvedDarkMode]);

  // Android native night mode follows the in-app theme. The
  // `@react-native-community/datetimepicker` spinner dialogs (parent theme
  // `Theme.AppCompat.DayNight.Dialog`) and every `Alert.alert` take their
  // colours from the Activity's AppCompat night mode, which is the SYSTEM
  // setting unless something overrides it. With the in-app theme forced to
  // dark on a light phone, the date and time pickers (Settings, Panchang,
  // Kundli) and the confirm alerts opened white over the dark app, and the
  // reverse happened with forced light on a dark phone.
  // `Appearance.setColorScheme` maps to `AppCompatDelegate.setDefaultNightMode`
  // (RN AppearanceModule), and MainActivity declares `uiMode` in
  // `configChanges`, so it becomes an in-place configuration change, not an
  // Activity recreate.
  //
  // In 'system' mode nothing is called unless this mount set an override
  // earlier, so a 'system' user gets exactly the launch night mode that
  // expo-system-ui sets from app.json `userInterfaceStyle: automatic` in
  // every MainActivity onCreate. That is not always FOLLOW_SYSTEM: below
  // Android 9 it is AUTO_BATTERY, while 'unspecified' always maps to
  // FOLLOW_SYSTEM, so calling it on every launch would switch a battery-saver
  // phone on Android 7–8.1 from dark to light. (Going back to 'system' after
  // a forced theme does use FOLLOW_SYSTEM there, until the next launch.) A
  // recreated Activity is back on the launch mode, and it mounts a new React
  // surface, so this effect runs again with a fresh ref and re-applies a
  // forced theme.
  //
  // Android only. On iOS the same call sets `overrideUserInterfaceStyle` on
  // every window, which also changes the NativeTabs bar and keyboard
  // materials, and that has not been checked on a device.
  const nativeSchemeOverridden = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'android' || !storeHydrated) return;
    if (themeMode === 'system') {
      if (!nativeSchemeOverridden.current) return;
      nativeSchemeOverridden.current = false;
      Appearance.setColorScheme('unspecified');
      return;
    }
    nativeSchemeOverridden.current = true;
    Appearance.setColorScheme(themeMode);
  }, [storeHydrated, themeMode]);

  // Native root background follows the resolved theme. The window background
  // is a drawable resolved from the AppCompat DayNight theme when the Activity
  // is created. It follows the SYSTEM scheme at launch, and it is not resolved
  // again on the in-place night-mode change above or on a system-theme flip.
  // So with the in-app theme forced to dark on a light phone, every area React
  // does not paint (a tab mounting for the first time, a stack transition, the
  // keyboard gap) shows the light window, which reads as a white flash.
  // Painting the decor view with `base` closes that gap for both overrides
  // and for a runtime system-theme flip. It is not set from app.json
  // `backgroundColor` because that writes ONE colour with no night variant,
  // which would flash the wrong ground in whichever mode it does not match.
  //
  // Keyed on `isDarkMode`, the same value `contentStyle` and the status bar
  // read. Gated on the store settling so the default (dark) store is not
  // painted first; the splash covers the decor view until then, and this
  // effect is declared ahead of the splash-hide effect (whose `hideAsync` runs
  // a frame later still), so the colour is queued before the splash lifts.
  // The native call rejects when there is no current Activity (the app was
  // backgrounded and its Activity destroyed); the remount on the next launch
  // runs this again, so the rejection is dropped rather than surfaced.
  useEffect(() => {
    if (!storeHydrated) return;
    SystemUI.setBackgroundColorAsync(isDarkMode ? darkColors.base : lightColors.base).catch(
      () => {},
    );
  }, [storeHydrated, isDarkMode]);

  const quietHours = useMemo(
    () => ({ enabled: quietHoursEnabled, startHHmm: quietHoursStart, endHHmm: quietHoursEnd }),
    [quietHoursEnabled, quietHoursStart, quietHoursEnd],
  );

  // First-open stamp (ad grace period). Only once hydration has actually
  // settled — never on the watchdog path, where the store still holds
  // defaults: `initFirstOpen` is a no-op when a stamp exists, so run against
  // defaults it stamps "now" for a years-old install, and before the storage
  // gate it also persisted the whole default blob with it. On a FAILED
  // hydrate the store genuinely is the defaults, so stamping is right.
  useEffect(() => {
    if (!hydrationSettled) return;
    initFirstOpen();
  }, [hydrationSettled, initFirstOpen]);

  // Sync i18n language whenever the persisted preference changes
  useEffect(() => {
    if (storeHydrated) {
      const resolved = resolveLanguage(language);
      if (i18n.language !== resolved) changeLanguage(resolved);
    }
  }, [language, storeHydrated]);

  // Two splash gates. Store hydration is the real one on every platform;
  // `fontsReady` is a constant `true` on Android (fonts are embedded in the
  // APK, nothing to wait for) and only ever holds the splash on iOS, where the
  // faces load at runtime. It resolves true on load failure too, so it can
  // never hang the splash the way the un-watchdogged hydrate could.
  const fontsReady = useAppFonts();
  const appReady = storeHydrated && fontsReady;

  useEffect(() => {
    if (!appReady) return;
    pmark('app:appReady');
    // Defer the splash hide one frame. If the user is unboarded, the
    // declarative Redirect in (tabs)/_layout.tsx kicks in this same render
    // commit; one rAF gives the navigator time to mount onboarding/step1
    // before the splash dissolves, otherwise on Android the user sees a
    // blank background between splash-gone and onboarding-mounted.
    const id = requestAnimationFrame(() => {
      pmark('app:splash:hide:call');
      SplashScreen.hideAsync();
    });
    return () => cancelAnimationFrame(id);
  }, [appReady]);

  // Cold-start widget refresh — covers the case where the user tapped the
  // widget to launch the app and we want fresh values written back before they
  // ever look at the home screen again.
  //
  // It used to sit in the effect above, right after the rAF that hides the
  // splash, and that was NOT free: `buildTodayWidgetPayload` falls back to
  // FALLBACK_COORDS, so its `await getCoords()` is always already-resolved and
  // never suspends. Every await in the chain is therefore a microtask, the
  // microtask queue drains before the next frame, and the rAF could not run
  // until a whole panchang compute had finished. `runAfterInteractions` puts it
  // behind the first frames instead.
  //
  // Also gated on `hasOnboarded`, like every other effect here: a fresh install
  // cannot have a widget placed yet, so computing a payload against fallback
  // coords for it is pure waste during onboarding.
  useEffect(() => {
    if (!appReady || !hasOnboarded) return;
    const handle = InteractionManager.runAfterInteractions(() => {
      void refreshTodayWidget();
    });
    return () => handle.cancel();
  }, [appReady, hasOnboarded]);

  // In-app changes that affect widget rendering (theme, language, numerals)
  // need to bypass the foreground-refresh debounce so the widget repaints
  // immediately when the user toggles a setting and tabs to home. Deferred the
  // same way — on a cold start this fires in the same commit as the effect
  // above, and `refreshTodayWidget` collapses the pair onto one in-flight
  // compute only if neither is on the paint path.
  //
  // The deps are the payload's render inputs, not just the resolved theme
  // (location, city label, region and ayanamsa change the computed day; the
  // four slot picks refresh from /settings/widget directly):
  // the widget payload carries `theme` from `themeMode` itself and formats
  // digits per `useDevanagariNumerals`. `isDarkMode` alone misses a themeMode
  // change that resolves to the same scheme (system → dark while the OS is
  // already dark), and neither it nor `language` moves on a numerals toggle —
  // both would leave the widget stale until the next resume.
  useEffect(() => {
    if (!appReady || !hasOnboarded) return;
    const handle = InteractionManager.runAfterInteractions(() => {
      void refreshTodayWidget({ force: true });
    });
    return () => handle.cancel();
  }, [appReady, hasOnboarded, isDarkMode, themeMode, language, useDevanagariNumerals, userLocation, locationName, region, ayanamsa]);

  useEffect(() => {
    if (appReady && !hasOnboarded) {
      router.replace('/onboarding/step1');
    }
  }, [appReady, hasOnboarded]);

  // ── App resume interstitial ───────────────────────────────────────────────
  const backgroundTimestampRef = useRef(0);

  useEffect(() => {
    if (!appReady || !hasOnboarded) return;

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        backgroundTimestampRef.current = Date.now();
        // Preload here, not on mount. The only consumer is the resume branch
        // below, which needs `elapsed >= APP_RESUME_MIN_BACKGROUND_MS` (60s) —
        // and `showInterstitial` refuses for the first 5 minutes of lifetime
        // anyway — so preloading at first paint built a full-screen creative
        // nobody could see yet, on the launch path.
        //
        // Only on a real 'background'. iOS raises 'inactive' for transient
        // interruptions (Control Centre, the notification shade, an incoming
        // call banner), none of which can accumulate 60s of elapsed time, so
        // fetching a creative for them is a pure network/memory cost. Every
        // genuine backgrounding passes through 'background' on both platforms.
        if (state === 'background') preloadInterstitial('appResume');
      } else if (state === 'active' && backgroundTimestampRef.current > 0) {
        const elapsed = Date.now() - backgroundTimestampRef.current;
        backgroundTimestampRef.current = 0;
        if (elapsed >= APP_RESUME_MIN_BACKGROUND_MS) {
          showInterstitial('appResume');
        }
        // Roll all three horizons forward under one read of the OS queue: the
        // daily reminder so tomorrow's vrat stays accurate, the sunrise alert
        // because each day's trigger is that day's real sunrise, and the 30-day
        // tithi/festival horizon. Individually gated inside the helper.
        void rollReminderHorizons({
          dailyReminderEnabled,
          dailyReminderTime,
          sunriseAlertEnabled,
          sunriseAlertOffsetMin,
          reminderPrefs,
          tithiReminderTime,
          festivalReminderTime,
          quietHours,
          coords: userLocation,
          ayanamsa,
          masaSystem,
        });
        // Foreground refresh of the home-screen widget. Debounced inside the
        // service so multiple resumes per minute don't recompute panchang.
        void refreshTodayWidget();
      }
    });
    return () => sub.remove();
  }, [appReady, hasOnboarded, dailyReminderEnabled, dailyReminderTime, reminderPrefs, tithiReminderTime, festivalReminderTime, quietHours, userLocation, ayanamsa, masaSystem, sunriseAlertEnabled, sunriseAlertOffsetMin]);

  // Roll reminder horizons on each cold start, and again whenever a setting
  // baked into the already-queued copy changes. Notification title/body are
  // rendered with `i18n.t` at SCHEDULE time and stored in the OS queue, so a
  // language switch would otherwise leave the whole horizon (30d tithi/festival
  // reminders, 14d daily + sunrise) in the old language until the next
  // foreground — that's why `language` is a dependency here. The i18n-sync
  // effect above is declared earlier, so `changeLanguage` has already run for
  // this commit, and every scheduler awaits the permission round-trip before it
  // renders a string.
  //
  // The AppState-resume effect above deliberately does NOT take `language`: its
  // listener reads the i18n singleton at call time, so it is already correct,
  // and the dep would only churn the subscription on every language switch.
  //
  // Delayed 1.5s so the residual native round trips land outside the launch
  // window. Deliberately a timer and NOT `InteractionManager`: an interaction
  // handle left open by an animation can starve `runAfterInteractions`
  // indefinitely, and a reminder horizon that silently never rolls forward is a
  // correctness bug, not a slow frame. Re-runs cancel the pending timer, so a
  // burst of setting changes only schedules once.
  useEffect(() => {
    if (!appReady || !hasOnboarded) return;
    const timer = setTimeout(() => {
      void rollReminderHorizons({
        dailyReminderEnabled,
        dailyReminderTime,
        sunriseAlertEnabled,
        sunriseAlertOffsetMin,
        reminderPrefs,
        tithiReminderTime,
        festivalReminderTime,
        quietHours,
        coords: userLocation,
        ayanamsa,
        masaSystem,
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [appReady, hasOnboarded, language, dailyReminderEnabled, dailyReminderTime, reminderPrefs, tithiReminderTime, festivalReminderTime, quietHours, userLocation, ayanamsa, masaSystem, sunriseAlertEnabled, sunriseAlertOffsetMin]);

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
              <Stack.Screen
                name="settings/widget"
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
              {/* Search swaps in/out as a content overlay rather than a push,
                  so a fade reads more "search dialog" than "drilldown". */}
              <Stack.Screen name="search" options={{ animation: 'fade' }} />
            </Stack>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />
          </SQLiteProvider>
        </Suspense>
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// ─── Crash screen ────────────────────────────────────────────────────────────
// expo-router wraps the root layout in `<Try catch={ErrorBoundary}>`, so this
// catches a throw from RootLayout's own render as well as anything below it —
// including `initDatabase` rejecting under `<SQLiteProvider useSuspense>`,
// which otherwise leaves a blank screen with no way out. `Try` force-hides the
// native splash before it renders us, so nothing else has to.
//
// Constraints, in order of importance: this must never throw itself.
//   · No Zustand — the store may be exactly what failed, and reading it here
//     would turn a recoverable error into an unrecoverable one.
//   · No SafeAreaProvider / GestureHandlerRootView context — we render in
//     RootLayout's place, so those providers are not mounted. Plain RN only.
//   · Colours are the Diya night palette hard-coded (palette.night / bone /
//     turmeric). Theme state lives in the store, so this screen deliberately
//     ignores light mode rather than risk not rendering at all.
//   · Copy goes through `i18n.t` with a `defaultValue`, so a missing key can
//     never surface as a raw dotted path. i18n initialises at module import,
//     so it is available even when nothing else is.

/** `i18n.t` that can neither throw nor render a raw key. */
function tSafe(key: string, fallback: string): string {
  try {
    const value = i18n.t(key, { defaultValue: fallback });
    return typeof value === 'string' && value.length > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Geist carries no Devanagari, so on a Hindi device every string on this screen
 * would fall through to a per-glyph system fallback. The crash screen is the
 * one surface that must render on the first try, so pick the face off the
 * resolved language rather than the theme (which lives in the store that may be
 * exactly what failed). Wrapped because a throw in here would replace the crash
 * screen with an uncatchable second one.
 */
function crashFont(latin: string, deva: string): string {
  try {
    return i18n.language?.startsWith('hi') ? deva : latin;
  } catch {
    return latin;
  }
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const titleFont = crashFont('Geist_500Medium', 'NotoSerifDevanagari_600SemiBold');
  const bodyFont = crashFont('Geist_400Regular', 'NotoSerifDevanagari_500Medium');
  const buttonFont = crashFont('Geist_600SemiBold', 'NotoSerifDevanagari_600SemiBold');
  const handleRetry = useCallback(() => {
    try {
      void retry();
    } catch {
      // A retry that fails must leave the crash screen standing, not replace
      // it with a second, uncatchable throw.
    }
  }, [retry]);

  return (
    <View style={crashStyles.screen}>
      <StatusBar style="light" />
      <Text style={[crashStyles.title, { fontFamily: titleFont }]}>
        {tSafe('appError.title', 'Something went wrong')}
      </Text>
      <Text style={[crashStyles.body, { fontFamily: bodyFont }]}>
        {tSafe(
          'appError.body',
          'The app could not finish loading. Try again, or close and reopen it.',
        )}
      </Text>
      {__DEV__ && !!error?.message && (
        <Text style={crashStyles.detail} selectable>
          {error.message}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={handleRetry}
        style={({ pressed }) => [crashStyles.button, pressed && crashStyles.buttonPressed]}>
        <Text style={[crashStyles.buttonLabel, { fontFamily: buttonFont }]}>{tSafe('common.retry', 'Retry')}</Text>
      </Pressable>
    </View>
  );
}

const crashStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // palette.night — the app's dark ground.
    backgroundColor: '#171220',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  title: {
    fontFamily: 'Geist_500Medium',
    fontSize: 20,
    letterSpacing: -0.1,
    textAlign: 'center',
    // palette.bone on palette.night — 15.21:1.
    color: '#EDE8F0',
  },
  body: {
    fontFamily: 'Geist_400Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    // darkColors.textSecondary composited on night — 6.43:1.
    color: 'rgba(237,232,240,0.62)',
  },
  detail: {
    fontFamily: 'Geist_400Regular',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 20,
    color: 'rgba(237,232,240,0.62)',
  },
  button: {
    marginTop: 28,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    // palette.turmeric fill — 8.02:1 against night, well over the 3:1 that a
    // non-text control needs.
    backgroundColor: '#D8A31A',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 16,
    // palette.night on the turmeric fill — 8.02:1. Never white on turmeric.
    color: '#171220',
  },
});
