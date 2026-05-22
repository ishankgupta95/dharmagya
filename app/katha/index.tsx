import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { AdBanner } from '@/components/common/AdBanner';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';

import { ALL_KATHAS, KATHA_DISCLAIMER } from '@/config/kathas';

/**
 * Vrat Kathas — listing screen.
 *
 * Lists the six library kathas (Satyanarayan + five vrat kathas) as editorial
 * rows. Unlike the aarti/chalisa readers, there is no in-screen language
 * toggle — the katha narrative prose is English-primary (see `@/config/kathas`)
 * so each row shows the Devanagari title with the English title beneath it.
 * The Practice tab routes here; tapping a row pushes `/katha/[slug]`.
 */
export default function KathaIndexScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';
  // Katha narrative prose is English-only, but the disclaimer is bilingual —
  // surface it in the app language so meta-text matches the chrome labels.
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {t('katha.indexTitle')}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Intro ───────────────────────────────────────────────────── */}
          <View style={styles.intro}>
            <Kicker color={colors.accent} size={11} style={styles.introEyebrow}>
              {t('katha.indexEyebrow')}
            </Kicker>
            <Text variant="body" style={[styles.introText, { color: colors.textSecondary }]}>
              {t('katha.indexIntro')}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.introOrnament} />
          </View>

          {/* ── Katha rows ──────────────────────────────────────────────── */}
          {ALL_KATHAS.map((k) => (
            <TouchableOpacity
              key={k.slug}
              onPress={() => router.push({ pathname: '/katha/[slug]', params: { slug: k.slug } })}
              activeOpacity={0.88}
              style={[styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('katha.a11yOpenKatha', { name: k.titleEnglish })}>
              <View style={[styles.rowIcon, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
                <Icon name="text" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  variant={lang === 'hi' ? 'deva-bold' : 'body'}
                  style={[styles.rowTitle, { color: colors.textPrimary }]}
                  numberOfLines={2}>
                  {lang === 'hi' ? k.titleHindi : k.titleEnglish}
                </Text>
              </View>
              <Icon name="chevron-right" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ))}

          {/* ── Disclaimer footer ───────────────────────────────────────── */}
          <View style={styles.disclaimerBlock}>
            <Kicker color={colors.textMuted} size={9}>{t('katha.sourcesLabel')}</Kicker>
            <Text variant="body-italic" style={[styles.disclaimerText, { color: colors.textMuted }]}>
              {KATHA_DISCLAIMER[lang]}
            </Text>
          </View>

          <View style={styles.adWrap}>
            <AdBanner colors={colors} placement="astrologyInline" inline />
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 22, lineHeight: 28, textAlign: 'center' },

  scroll: { paddingTop: 16, paddingBottom: 24 },

  // Intro
  intro: { alignItems: 'center', marginBottom: 22, paddingHorizontal: 4 },
  introEyebrow: { letterSpacing: 3.5, marginBottom: 10 },
  introText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  introOrnament: { marginTop: 14, width: '50%' },

  // Katha rows
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.cardPadLg,
    paddingVertical: 14,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    marginBottom: 10,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 15.5, lineHeight: 21 },

  // Disclaimer
  disclaimerBlock: { marginTop: 14, gap: 8 },
  disclaimerText: { fontSize: 12, lineHeight: 19 },

  adWrap: { marginTop: 16 },
});
