import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { darkColors, lightColors, palette } from '@/config/theme';
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
      iconColor={{ default: colors.textTertiary, selected: colors.accent }}
      labelStyle={{
        default: { color: colors.textTertiary, fontFamily: 'Geist_400Regular', fontSize: 10 },
        selected: { color: colors.accent, fontFamily: 'Geist_500Medium', fontSize: 10 },
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
