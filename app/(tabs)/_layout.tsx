import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { AppState, InteractionManager, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { darkColors, lightColors, palette } from '@/config/theme';
import { getAdsState, initAds } from '@/services/adsConsent';
import { useStore } from '@/store/useStore';
import { pmark } from '@/utils/perfProfile';

// Diya — the tab bar is the OS's own control (expo-router NativeTabs → a real
// UITabBarController / Material BottomNavigationView). iOS 26 supplies Liquid
// Glass, Android the anchored Material nav bar with the pill indicator. No
// custom bar, no manual blur (design_handoff_diya).
export default function TabLayout() {
  pmark('tabs:_layout:render');
  const { t } = useTranslation();
  const isDark = useStore((s) => s.isDarkMode);
  const hasOnboarded = useStore((s) => s.hasOnboarded);

  // UMP consent → Mobile Ads init (src/services/adsConsent.ts). Kicked from
  // here rather than app/_layout.tsx so the Google consent form can never
  // interrupt onboarding — and, because this layout also renders (and
  // redirects, below) while `hasOnboarded` is false, the effect arms only once
  // it is true. Deferred behind runAfterInteractions so the tabs' first paint
  // never waits on it. Nothing from react-native-google-mobile-ads is imported
  // at module scope here; initAds() resolves the native module lazily.
  //
  // The foreground listener is the retry path: a run that settled `failed`
  // (offline first launch, captive portal, UMP unreachable with no stored
  // decision) is re-attempted the next time the app comes back to the front.
  // initAds() is idempotent and the status read is synchronous, so while the
  // gate is `ready` this costs a string compare per foreground.
  useEffect(() => {
    if (!hasOnboarded) return;
    const task = InteractionManager.runAfterInteractions(() => { void initAds(); });
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && getAdsState().status === 'failed') void initAds();
    });
    return () => {
      task.cancel();
      sub.remove();
    };
  }, [hasOnboarded]);

  // Declarative redirect short-circuits the (tabs) layout before its children
  // mount on cold start (see the note in app/_layout.tsx).
  if (!hasOnboarded) return <Redirect href="/onboarding/step1" />;

  const colors = isDark ? darkColors : lightColors;

  return (
    <NativeTabs
      // iOS: leave the bar material alone — the system glass is the design.
      // Android: opaque anchored surface + accent-tinted pill indicator.
      backgroundColor={Platform.OS === 'android' ? (isDark ? palette.nightRaised : palette.riceCard) : undefined}
      indicatorColor={isDark ? 'rgba(216,163,26,0.16)' : lightColors.accentSurface}
      rippleColor={isDark ? 'rgba(216,163,26,0.12)' : 'rgba(122,89,0,0.10)'}
      // The selected trigger draws its icon and label as *words on* the bar,
      // so it takes `accentText`, not the `accent` fill used for the indicator
      // pill and the badge. On the light bar turmeric is 2.29:1 — the selected
      // tab was less legible than the unselected ones, inverting the only
      // "where am I" cue in the app's top-level navigation.
      iconColor={{ default: colors.textTertiary, selected: colors.accentText }}
      labelStyle={{
        default: { color: colors.textTertiary, fontFamily: 'Geist_400Regular', fontSize: 10 },
        selected: { color: colors.accentText, fontFamily: 'Geist_500Medium', fontSize: 10 },
      }}
      badgeBackgroundColor={colors.accent}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.home')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="panchang">
        <NativeTabs.Trigger.Label>{t('tabs.panchang')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="astrology">
        <NativeTabs.Trigger.Label>{t('tabs.astrology')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'safari', selected: 'safari.fill' }} md="explore" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Label>{t('tabs.library')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }} md="auto_stories" />
      </NativeTabs.Trigger>
      {/* Devotion content lives in the Library tab (P16.5). Settings is a
          plain stack route at /settings — a hidden NativeTabs trigger is
          filtered out of the native controller and can never be focused, so
          routing to it silently no-ops. Practice stays declared (its file
          still exists) but nothing links to it since the P16.5 merge. */}
      <NativeTabs.Trigger name="practice" hidden />
    </NativeTabs>
  );
}
