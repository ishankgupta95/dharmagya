import { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MotionPressable } from '@/components/common/MotionPressable';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { AdBanner } from '@/components/common/AdBanner';
import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { useInterstitialOnExit } from '@/hooks/useInterstitialOnExit';
import { resolveLanguage } from '@/i18n';
import {
  getAllAppPrayers,
  prayerMeaning,
  type Prayer,
  type PrayerOccasion,
  type ContentLang,
} from '@/services/content';

// Stable display order for the occasion groups — follows the rhythm of the day.
const OCCASION_ORDER: PrayerOccasion[] = [
  'morning', 'bath', 'meal', 'evening', 'night', 'invocation', 'closing',
];

export default function PrayersScreen() {
  useInterstitialOnExit();
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const appLanguage = useStore(s => s.language);
  const colors = isDarkMode ? darkColors : lightColors;
  const lang: ContentLang = useMemo(() => resolveLanguage(appLanguage), [appLanguage]);

  // Group prayers by occasion, in OCCASION_ORDER, dropping empty groups.
  const groups = useMemo(() => {
    const all = getAllAppPrayers();
    return OCCASION_ORDER
      .map(occasion => ({ occasion, prayers: all.filter(p => p.occasion === occasion) }))
      .filter(g => g.prayers.length > 0);
  }, []);

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={[styles.navRow, { borderBottomColor: colors.divider }]}>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </MotionPressable>
          <View style={styles.compactTitle} pointerEvents="none">
            <Text variant="body-italic" style={[styles.compactTitleText, { color: colors.textPrimary }]} numberOfLines={1}>
              {t('prayers.title')}
            </Text>
          </View>
          <View style={styles.navPill} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <View style={styles.heroBlock}>
            <Kicker color={colors.accent} size={11} style={styles.heroEyebrow}>
              {t('prayers.eyebrow')}
            </Kicker>
            <Kicker color={colors.accent} size={22} style={styles.heroTitle}>
              {t('prayers.title')}
            </Kicker>
            <Ornament variant="lotus" style={styles.heroRule} />
          </View>

          <Text variant="body" style={[styles.intro, { color: colors.textSecondary }]}>
            {t('prayers.intro')}
          </Text>

          {groups.length === 0 ? (
            <Text variant="body-italic" style={[styles.empty, { color: colors.textMuted }]}>
              {t('prayers.notFound')}
            </Text>
          ) : (
            groups.map(group => (
              <View key={group.occasion}>
                <Kicker
                  color={palette.gold}
                  size={9}
                  withTrailingRule
                  ruleColor={colors.divider}
                  wrapperStyle={styles.groupKicker}
                  style={styles.groupKickerText}>
                  {t(`prayers.occasion.${group.occasion}`)}
                </Kicker>
                {group.prayers.map(prayer => (
                  <PrayerCard key={prayer.slug} prayer={prayer} lang={lang} colors={colors} />
                ))}
              </View>
            ))
          )}

          <Text variant="body-italic" style={[styles.verifyNote, { color: colors.textMuted }]}>
            {t('reader.verifyNote')}
          </Text>

          <View style={styles.adWrap}>
            <AdBanner colors={colors} placement="astrologyInline" inline />
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

function PrayerCard({ prayer, lang, colors }: { prayer: Prayer; lang: ContentLang; colors: ColorPalette }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="deva-bold" style={[styles.cardTitleNative, { color: colors.textPrimary }]}>
        {prayer.titleHindi}
      </Text>
      <Text variant="body-italic" style={[styles.cardTitleEn, { color: colors.textTertiary }]}>
        {prayer.titleEnglish}
      </Text>
      <Ornament variant="double-rule" style={styles.cardRule} />
      <Text variant="deva" style={[styles.cardDeva, { color: colors.textPrimary }]}>
        {prayer.text.devanagari}
      </Text>
      {!!prayer.text.iast && (
        <Text variant="body-italic" style={[styles.cardIast, { color: colors.textTertiary }]}>
          {prayer.text.iast}
        </Text>
      )}
      {/* Hindi meaning is Devanagari prose → `deva`; English → `body`. */}
      <Text
        variant={lang === 'hi' ? 'deva' : 'body'}
        style={[styles.cardMeaning, { color: colors.textSecondary }]}>
        {prayerMeaning(prayer, lang)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenH,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactTitle: { flex: 1, alignItems: 'center', marginHorizontal: 12 },
  compactTitleText: { fontSize: 15, textAlign: 'center' },

  scroll: { paddingTop: 20, paddingBottom: 32 },

  heroBlock: { alignItems: 'center', marginBottom: 18, paddingTop: 8 },
  heroEyebrow: { letterSpacing: 4.0, textAlign: 'center', marginBottom: 12 },
  heroTitle: { lineHeight: 32, letterSpacing: 2.8, textAlign: 'center', paddingHorizontal: 12 },
  heroRule: { marginTop: 20, width: '60%' },

  intro: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 18, paddingHorizontal: 4 },
  empty: { fontSize: 15, textAlign: 'center', marginTop: 40 },

  groupKicker: { marginTop: 8, marginBottom: 12 },
  groupKickerText: { letterSpacing: 2.4 },

  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
    marginBottom: 14,
  },
  cardTitleNative: { fontSize: 18, lineHeight: 24 },
  cardTitleEn: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  cardRule: { marginVertical: 12, width: '40%' },
  cardDeva: { fontSize: 18, lineHeight: 29 },
  cardIast: { fontSize: 13, lineHeight: 20, marginTop: 8 },
  cardMeaning: { fontSize: 13.5, lineHeight: 21, marginTop: 12 },

  verifyNote: { fontSize: 11.5, lineHeight: 17, marginTop: 8, textAlign: 'center' },
  adWrap: { marginTop: 20 },
});
