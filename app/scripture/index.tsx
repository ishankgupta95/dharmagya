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

import { ALL_SCRIPTURES, SCRIPTURE_DISCLAIMER } from '@/config/scriptures';

/**
 * Scripture index — three entries: Bhagavad Geeta + Durga Saptashati (outline)
 * + Sundarkand, in alphabetical order. Tapping a row pushes `/scripture/[id]`.
 * Each row shows a single title in the app language (Devanagari for Hindi,
 * English otherwise) — no stacked-bilingual treatment.
 */
export default function ScriptureIndexScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  // Saptashati lives outside the library (no verses; it's an outline + 9-day
  // map sourced from `@/config/navratri`). Merge it into the index so users
  // see one consolidated list of scriptures.
  type Row = { id: string; titleEn: string; titleHi: string };
  const rows: Row[] = [
    ...ALL_SCRIPTURES.map((s) => ({ id: s.slug, titleEn: s.titleEnglish, titleHi: s.titleHindi })),
    { id: 'durga-saptashati', titleEn: 'Durga Saptashati', titleHi: 'दुर्गा सप्तशती' },
  ].sort((a, b) => a.titleEn.localeCompare(b.titleEn));

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
            {t('scripture.indexTitle')}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Intro ───────────────────────────────────────────────────── */}
          <View style={styles.intro}>
            <Kicker color={colors.accent} size={11} style={styles.introEyebrow}>
              {t('scripture.indexEyebrow')}
            </Kicker>
            <Text variant="body" style={[styles.introText, { color: colors.textSecondary }]}>
              {t('scripture.indexIntro')}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.introOrnament} />
          </View>

          {/* ── Scripture rows ──────────────────────────────────────────── */}
          {rows.map((r) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => router.push({ pathname: '/scripture/[id]', params: { id: r.id } })}
              activeOpacity={0.88}
              style={[styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('scripture.a11yOpenScripture', { name: r.titleEn })}>
              <View style={[styles.rowIcon, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
                <Icon name="school" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  variant={lang === 'hi' ? 'deva-bold' : 'body'}
                  style={[styles.rowTitle, { color: colors.textPrimary }]}
                  numberOfLines={2}>
                  {lang === 'hi' ? r.titleHi : r.titleEn}
                </Text>
              </View>
              <Icon name="chevron-right" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ))}

          {/* ── Disclaimer footer ───────────────────────────────────────── */}
          <View style={styles.disclaimerBlock}>
            <Kicker color={colors.textMuted} size={9}>{t('scripture.sourcesLabel')}</Kicker>
            <Text variant="body-italic" style={[styles.disclaimerText, { color: colors.textMuted }]}>
              {SCRIPTURE_DISCLAIMER[lang]}
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

  // Scripture rows
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
