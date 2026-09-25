import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AdBanner } from '@/components/common/AdBanner';
import { AppText as Text } from '@/components/common/AppText';
import { ScreenMount } from '@/components/common/ScreenMount';
import { useStore, type Ayanamsa } from '@/store/useStore';
import { darkColors, lightColors, spacing } from '@/config/theme';
import { KundliSection } from '@/components/kundli/KundliSection';

// panchang-ts's `AyanamsaType` values are not the i18n leaf names: the library
// says 'krishnamurti' and 'true-chitra', while the locale bundles key those two
// as `kp` and `trueChitra`. Interpolating the stored value straight into the key
// path therefore printed the raw path (`settings.ayanamsa.krishnamurti`) in the
// header for anyone on KP or True Chitra. Typed as a total Record so a new
// `AyanamsaType` in the library breaks the build here instead of leaking a key
// path to the user.
const AYANAMSA_LABEL_KEY: Record<Ayanamsa, string> = {
  lahiri: 'settings.ayanamsa.lahiri',
  raman: 'settings.ayanamsa.raman',
  krishnamurti: 'settings.ayanamsa.kp',
  'true-chitra': 'settings.ayanamsa.trueChitra',
  thirukanitham: 'settings.ayanamsa.thirukanitham',
};

// The Kundli tab. Dasha + Sade Sati used to be sibling chips here; as of P16.2
// they fold into KundliSection as chart-derived sub-sections (Sade Sati in the
// Basics layer, the full dasha timeline behind the "Advanced chart" switch), so
// this screen is now a thin header + the single Kundli view.
export default function AstrologyTab() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const ayanamsa = useStore((s) => s.ayanamsa);
  const colors = isDarkMode ? darkColors : lightColors;

  // NativeTabs has no lazy/freeze gate (see `app/(tabs)/_layout.tsx`), so this
  // tab mounts on cold start alongside Home — and `KundliSection` runs the full
  // synchronous `computeKundli` (plus the Vimshottari timeline) in render for
  // anyone with birth details. That was the single largest piece of cold-start
  // work nobody had asked for, and it landed just as the user's first tap on
  // Home did. Holding the subtree back until this tab is first focused moves
  // the whole cost to the moment the chart is actually wanted.
  //
  // Gating the mount rather than the compute inside `KundliSection`: the
  // component has no effects and no subscriptions to preserve, and a null
  // `bundle` there means "compute failed" — which would have flashed its error
  // copy for a frame on the way in. One-way latch, so the section mounts once
  // and keeps every bit of its state (open accordions, selected varga, name
  // draft) for the rest of the session.
  const isFocused = useIsFocused();
  const [hasBeenFocused, setHasBeenFocused] = useState(isFocused);
  if (isFocused && !hasBeenFocused) setHasBeenFocused(true);

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
        {/* Diya frame 08 — light display title; the ayanamsa in use sits quietly
            on the right so charts are never read against the wrong zodiac. */}
        <View style={[styles.header, { paddingHorizontal: spacing.screenH }]}>
          <Text variant="display" style={[styles.title, { color: colors.textPrimary }]}>
            {t('astrology.kundli')}
          </Text>
          <Text variant="body" style={[styles.ayanamsa, { color: colors.textTertiary }]} numberOfLines={1}>
            {t(AYANAMSA_LABEL_KEY[ayanamsa] ?? AYANAMSA_LABEL_KEY.lahiri).replace(/\s*\(.*\)$/, '')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          // iOS: react-native-screens only applies the tab-bar content inset to the
          // first ScrollView in the tab screen's first-descendant chain, and here the
          // title header comes first, so React Native's iOS default (Never) stuck.
          // Without this the end of the scroll content sits permanently under
          // the floating tab bar and cannot be tapped (Android ignores the prop).
          contentInsetAdjustmentBehavior="automatic"
          // iOS only (Android resizes the window for the keyboard): the name
          // field in KundliSection's inline form is a TextInput inside this
          // ScrollView, and without this the keyboard slides over the form.
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}>
          {hasBeenFocused && <KundliSection />}
        </ScrollView>

        <AdBanner colors={colors} placement="astrologyInline" aboveTabBar />
      </SafeAreaView>
    </ScreenMount>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: { fontSize: 30, lineHeight: 36, flexShrink: 1 },
  ayanamsa: { fontSize: 13, marginBottom: 4 },

  scroll: {
    paddingTop: 4,
    paddingBottom: 32,
  },
});
