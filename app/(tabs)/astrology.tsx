import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AdBanner } from '@/components/common/AdBanner';
import { AppText as Text } from '@/components/common/AppText';
import { ScreenMount } from '@/components/common/ScreenMount';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import { useStore } from '@/store/useStore';
import { darkColors, lightColors, palette, spacing, borderRadius } from '@/config/theme';
import { KundliSection } from '@/components/kundli/KundliSection';
import { DashaSection } from '@/components/kundli/DashaSection';
import { SadeSatiSection } from '@/components/kundli/SadeSatiSection';

type Section = 'kundli' | 'dasha' | 'sadeSati';

export default function AstrologyTab() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const [section, setSection] = useState<Section>('kundli');

  const segments: { key: Section; label: string }[] = [
    { key: 'kundli', label: t('astrology.kundli') },
    { key: 'dasha', label: t('astrology.dasha') },
    { key: 'sadeSati', label: t('astrology.sadeSati') },
  ];

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
        <View style={[styles.header, { paddingHorizontal: spacing.screenH }]}>
          <Text variant="display-italic" style={[styles.title, { color: colors.textPrimary }]}>
            {t('astrology.title')}
          </Text>
        </View>

        <View style={[styles.segments, { paddingHorizontal: spacing.screenH }]}>
          {segments.map((seg) => (
            <SegmentedChip
              key={seg.key}
              active={section === seg.key}
              onPress={() => setSection(seg.key)}
              inactiveBg="transparent"
              activeBg={isDarkMode ? palette.goldLeaf : palette.sindoor}
              inactiveBorder={colors.border}
              activeBorder="transparent"
              style={styles.segChip}
              accessibilityLabel={seg.label}>
              <Text
                variant="mono-caps"
                style={[
                  styles.segText,
                  {
                    color:
                      section === seg.key ? palette.parchmentBright : colors.textSecondary,
                  },
                ]}>
                {seg.label}
              </Text>
            </SegmentedChip>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>
          {section === 'kundli' && <KundliSection />}
          {section === 'dasha' && <DashaSection />}
          {section === 'sadeSati' && <SadeSatiSection />}
        </ScrollView>

        <AdBanner colors={colors} placement="astrologyInline" />
      </SafeAreaView>
    </ScreenMount>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { fontSize: 30, lineHeight: 36 },

  segments: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 14,
  },
  segChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    alignItems: 'center',
  },
  segText: { fontSize: 9 },

  scroll: {
    paddingTop: 4,
    paddingBottom: 32,
  },

});
