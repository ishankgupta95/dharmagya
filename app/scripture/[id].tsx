import { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import { resolveLanguage } from '@/i18n';

import {
  NAVRATRI_SOURCES,
  SAPTASHATI_CHAPTERS,
  SAPTASHATI_DAY_MAP,
} from '@/config/navratri';

type Lang = 'en' | 'hi';

/**
 * Scripture reader — currently surfaces the Durga Saptashati outline + the
 * 9-day chapter map. Full verses are deferred (700-verse content-review pass
 * out of v1 scope); this screen ships the chapter outline + day-mapping per
 * PLAN §8 P14.3 exit criteria.
 *
 * Route is `/scripture/[id]` so future scriptures (Devi Bhagavatam, Lalita
 * Sahasranama, etc.) can land here without a re-architect — for v1 only the
 * id `'durga-saptashati'` is supported.
 */
export default function ScriptureDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';
  const appLanguage = useStore(s => s.language);

  const [lang, setLang] = useState<Lang>(() => resolveLanguage(appLanguage) as Lang);

  // Both hooks must run before any conditional return — Saptashati is the
  // only scripture in v1, but the same hook order has to hold even on the
  // not-found branch.
  const dayMap = useMemo(() => SAPTASHATI_DAY_MAP, []);
  const chapters = useMemo(() => SAPTASHATI_CHAPTERS, []);

  if (id !== 'durga-saptashati') {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={styles.notFoundWrap}>
          <Text variant="body-italic" style={[styles.notFoundText, { color: colors.textMuted }]}>
            {t('scripture.notFound')}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.notFoundBtn, { borderColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Text variant="mono-caps" style={[styles.notFoundBtnText, { color: colors.accent }]}>
              {t('common.back') ?? 'Back'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const titleByLang: Record<Lang, string> = {
    en: 'Durga Saptashati',
    hi: 'दुर्गा सप्तशती',
  };
  const subtitleByLang: Record<Lang, string> = {
    en: 'Devī Māhātmya · 13 chapters · 700 verses',
    hi: 'देवी माहात्म्य · त्रयोदश अध्याय · सात सौ श्लोक',
  };

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={[styles.navRow, { borderBottomColor: colors.divider }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={[styles.navPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          style={{ backgroundColor: colors.base }}
          contentContainerStyle={[styles.bodyScroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Editorial title block ──────────────────────────────────── */}
          <View style={styles.heroBlock}>
            <Kicker color={colors.accent} size={11} style={styles.heroEyebrow}>
              {t('scripture.kickerSaptashati')}
            </Kicker>
            <Kicker color={colors.accent} size={22} style={styles.heroTitle}>
              {titleByLang[lang]}
            </Kicker>
            <Text variant="body-italic" style={[styles.heroSubtitle, { color: colors.textTertiary }]}>
              {subtitleByLang[lang]}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.heroRule} />
          </View>

          {/* ── Lang toggle ─────────────────────────────────────────────── */}
          <View style={styles.langToggleBar}>
            <View style={[styles.langToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <LangChip label={t('langToggle.english')} active={lang === 'en'} onPress={() => setLang('en')} colors={colors} />
              <LangChip label={t('langToggle.hindi')}   active={lang === 'hi'} onPress={() => setLang('hi')} colors={colors} />
            </View>
          </View>

          {/* ── About — what the Saptashati is ──────────────────────────── */}
          <View style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Kicker color={colors.accent} size={10}>{t('scripture.aboutLabel')}</Kicker>
            <Text variant="body" style={[styles.aboutText, { color: colors.textSecondary }]}>
              {lang === 'hi'
                ? 'दुर्गा सप्तशती — मार्कण्डेय पुराण के ८१–९३ अध्याय। तीन चरित्र (मध्यम-पाठ): प्रथम चरित्र — महाकाली; मध्यम चरित्र — महालक्ष्मी; उत्तम चरित्र — महासरस्वती। नवरात्रि की नौ रात्रियों में पारंपरिक पाठ-क्रम के अनुसार पठित।'
                : "The Durga Saptashati (chapters 81–93 of the Mārkaṇḍeya Purāṇa) is the foundational scripture of Devī worship. Three caritas: Prathama (Mahakali, ch 1), Madhyama (Mahalakshmi, ch 2–4), Uttama (Mahasaraswati, ch 5–13). Read across the 9 nights of Navratri in the schedule below."}
            </Text>
            <Text variant="body-italic" style={[styles.aboutReviewNote, { color: colors.textMuted }]}>
              {t('scripture.reviewNote')}
            </Text>
          </View>

          {/* ── 9-day chapter map ───────────────────────────────────────── */}
          <View style={styles.section}>
            <Kicker color={colors.accent} size={10} style={styles.sectionKicker}>
              {t('scripture.dayMapLabel')}
            </Kicker>
            {dayMap.map(entry => (
              <View
                key={entry.day}
                style={[styles.dayMapRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.dayNumCol, { borderRightColor: colors.divider }]}>
                  <Text variant="mono-caps" style={[styles.dayNumKicker, { color: colors.textMuted }]}>
                    {t('navratri.dayShortLabel')}
                  </Text>
                  <Text variant="display-italic" style={[styles.dayNum, { color: colors.textPrimary }]}>
                    {String(entry.day)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="body" style={[styles.dayMapChapters, { color: colors.textPrimary }]}>
                    {t('scripture.chaptersN', {
                      count: entry.chapters.length,
                      list: entry.chapters.join(', '),
                    })}
                  </Text>
                  <Text variant="body-italic" style={[styles.dayMapNote, { color: colors.textSecondary }]}>
                    {entry.note[lang]}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* ── Chapter outline (13 chapters) ───────────────────────────── */}
          <View style={[styles.section, { marginTop: 8 }]}>
            <Kicker color={colors.accent} size={10} style={styles.sectionKicker}>
              {t('scripture.chaptersLabel')}
            </Kicker>
            {chapters.map(ch => (
              <View
                key={ch.number}
                style={[styles.chapterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.chapterHead}>
                  <Kicker color={palette.gold} size={9} withTrailingRule ruleColor={colors.divider}
                    wrapperStyle={styles.chapterKickerWrap}>
                    {t('scripture.chapterKicker', { num: ch.number })}
                  </Kicker>
                </View>
                <Text variant="deva-bold" style={[styles.chapterSanskrit, { color: colors.textPrimary }]}>
                  {ch.titleSanskrit}
                </Text>
                <Text variant="body-italic" style={[styles.chapterTitle, { color: colors.textSecondary }]}>
                  {lang === 'hi' ? ch.titleHindi : ch.titleEnglish}
                </Text>
                <Text variant="body" style={[styles.chapterTheme, { color: colors.textSecondary }]}>
                  {ch.theme[lang]}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Sources / disclaimer ──────────────────────────────────────── */}
          <View style={styles.sourcesBlock}>
            <Kicker color={colors.textMuted} size={9}>{t('navratri.sourcesLabel')}</Kicker>
            <Text variant="body-italic" style={[styles.sourcesText, { color: colors.textMuted }]}>
              {NAVRATRI_SOURCES[lang]}
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LangChip({ label, active, onPress, colors }: { label: string; active: boolean; onPress: () => void; colors: ColorPalette }) {
  return (
    <SegmentedChip
      active={active}
      onPress={onPress}
      inactiveBg="transparent"
      activeBg={palette.ink}
      style={styles.langChip}
      accessibilityLabel={label}>
      <Text
        variant="mono-caps"
        style={[styles.langChipText, { color: active ? palette.parchmentBright : colors.textTertiary }]}>
        {label}
      </Text>
    </SegmentedChip>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    justifyContent: 'center',
    alignItems: 'center',
  },

  bodyScroll: { paddingTop: 20, paddingBottom: 32 },

  // Editorial masthead
  heroBlock: { alignItems: 'center', marginBottom: 22, paddingTop: 8 },
  heroEyebrow: { letterSpacing: 4.0, textAlign: 'center', marginBottom: 12 },
  heroTitle: { lineHeight: 32, letterSpacing: 2.8, textAlign: 'center', paddingHorizontal: 12 },
  heroSubtitle: { fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },
  heroRule: { marginTop: 16, width: '60%' },

  // Lang toggle
  langToggleBar: { alignItems: 'center', paddingBottom: 22 },
  langToggle: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  langChip: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 17,
    minWidth: 96,
    alignItems: 'center',
  },
  langChipText: { fontSize: 9.5 },

  // About block
  aboutCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
    marginBottom: spacing.cardGap,
  },
  aboutText: { fontSize: 14, lineHeight: 22, marginTop: 10 },
  aboutReviewNote: { fontSize: 11.5, lineHeight: 17, marginTop: 12 },

  // Section
  section: { marginBottom: 8 },
  sectionKicker: { marginBottom: 12 },

  // Day map
  dayMapRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  dayNumCol: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  dayNumKicker: { fontSize: 8, letterSpacing: 1.4 },
  dayNum: { fontSize: 24, lineHeight: 28, marginTop: 4 },
  dayMapChapters: { fontSize: 14, lineHeight: 21, padding: 14, paddingBottom: 4 },
  dayMapNote: { fontSize: 12.5, lineHeight: 18, paddingHorizontal: 14, paddingBottom: 12 },

  // Chapter
  chapterCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
    marginBottom: 10,
  },
  chapterHead: { marginBottom: 8 },
  chapterKickerWrap: { width: '100%' },
  chapterSanskrit: { fontSize: 18, lineHeight: 26, marginTop: 4 },
  chapterTitle: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  chapterTheme: { fontSize: 14, lineHeight: 22, marginTop: 10 },

  // Sources
  sourcesBlock: { marginTop: 4, gap: 8 },
  sourcesText: { fontSize: 12, lineHeight: 19 },

  // Not-found
  notFoundWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 40 },
  notFoundText: { fontSize: 15, textAlign: 'center' },
  notFoundBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  notFoundBtnText: { fontSize: 10 },
});
