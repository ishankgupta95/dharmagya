import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AdBanner } from '@/components/common/AdBanner';
import { AppText as Text } from '@/components/common/AppText';
import { ScreenMount } from '@/components/common/ScreenMount';
import { useStore } from '@/store/useStore';
import { darkColors, lightColors, spacing } from '@/config/theme';
import { KundliSection } from '@/components/kundli/KundliSection';

// The Kundli tab. Dasha + Sade Sati used to be sibling chips here; as of P16.2
// they fold into KundliSection as chart-derived sub-sections (Sade Sati in the
// Basics layer, the full dasha timeline behind the "Advanced chart" switch), so
// this screen is now a thin header + the single Kundli view.
export default function AstrologyTab() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const ayanamsa = useStore((s) => s.ayanamsa);
  const colors = isDarkMode ? darkColors : lightColors;

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
            {t(`settings.ayanamsa.${ayanamsa}`).replace(/\s*\(.*\)$/, '')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>
          <KundliSection />
        </ScrollView>

        <AdBanner colors={colors} placement="astrologyInline" />
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
