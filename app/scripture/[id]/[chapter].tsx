import { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, palette, spacing, type ColorPalette } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { LangToggle, type ContentLang } from '@/components/common/LangToggle';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import i18n, { resolveLanguage } from '@/i18n';

import {
  getScriptureBySlug,
  SCRIPTURE_DISCLAIMER,
  type Chapter,
  type ScriptureVerse,
} from '@/config/scriptures';

type Lang = ContentLang;

/**
 * Scripture verse reader — one chapter at a time. Reads `id` + `chapter` from
 * the route, resolves the scripture and chapter, and renders the source text
 * verse-by-verse with a VERSE N kicker above each shloka. Geeta verses carry
 * Devanagari + IAST; Sundarkand verses are Devanagari only. No English
 * translation is shipped — the disclaimer points the reader at a trusted
 * translation when meaning matters.
 */
export default function ScriptureChapterScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';
  const appLanguage = useStore((s) => s.language);

  // In-screen LangToggle mirrors aarti / chalisa: Hindi mode shows Devanagari
  // verses, English mode shows IAST (Latin-script transliteration). Sundarkand
  // has no IAST, so its English mode falls back to Devanagari silently.
  const [lang, setLang] = useState<Lang>(() => resolveLanguage(appLanguage));
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

  const { id, chapter } = useLocalSearchParams<{ id?: string; chapter?: string }>();
  const scripture = useMemo(() => getScriptureBySlug(id), [id]);
  const chapterNum = chapter ? parseInt(chapter, 10) : NaN;
  const chapterData: Chapter | undefined = useMemo(() => {
    if (!scripture || !Number.isFinite(chapterNum)) return undefined;
    return scripture.chapters.find((c) => c.number === chapterNum);
  }, [scripture, chapterNum]);

  if (!scripture || !chapterData) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>
        <View style={styles.emptyWrap}>
          <Text variant="body-italic" style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('scripture.notFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const scriptureTitle = lang === 'hi' ? scripture.titleHindi : scripture.titleEnglish;
  // Chapter heading: one title in the app language — Devanagari for Hindi,
  // titleEnglish for English (with fallbacks if a field is missing).
  const chapterHeading = lang === 'hi'
    ? (chapterData.titleSanskrit ?? chapterData.titleEnglish ?? '')
    : (chapterData.titleEnglish ?? chapterData.titleSanskrit ?? '');

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text variant="body-italic" style={[styles.headerCrumb, { color: colors.textTertiary }]} numberOfLines={1}>
            {scriptureTitle}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Chapter heading ─────────────────────────────────────────── */}
          <View style={styles.heroBlock}>
            <Kicker color={palette.gold} size={11} style={styles.heroKicker}>
              {tForLang('scripture.chapterKicker', { num: chapterData.number })}
            </Kicker>
            <Text
              variant={lang === 'hi' ? 'deva-bold' : 'display-italic'}
              style={[styles.heroTitle, { color: colors.textPrimary }]}>
              {chapterHeading}
            </Text>
            <Text variant="mono-caps" style={[styles.heroVerseCount, { color: colors.textMuted }]}>
              {tForLang('scripture.versesNCount', { count: chapterData.verses.length })}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.heroOrnament} />
          </View>

          {/* ── Lang toggle (shared component) ──────────────────────────── */}
          <LangToggle lang={lang} onChange={setLang} colors={colors} />

          {/* ── Verses ─────────────────────────────────────────────────── */}
          {chapterData.verses.map((verse, i) => (
            <VerseBlock
              key={i}
              verse={verse}
              index={i + 1}
              lang={lang}
              colors={colors}
              t={tForLang}
            />
          ))}

          {/* ── Sources / disclaimer ──────────────────────────────────── */}
          <View style={styles.sourcesBlock}>
            <Kicker color={colors.textMuted} size={9}>{tForLang('scripture.sourcesLabel')}</Kicker>
            <Text variant="body-italic" style={[styles.sourcesText, { color: colors.textMuted }]}>
              {SCRIPTURE_DISCLAIMER[lang]}
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

// ─── VerseBlock ─────────────────────────────────────────────────────────────

function VerseBlock({
  verse,
  index,
  lang,
  colors,
  t,
}: {
  verse: ScriptureVerse;
  index: number;
  lang: Lang;
  colors: ColorPalette;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  // Hindi mode: Devanagari source. English mode: IAST (Latin transliteration);
  // fall back to Devanagari when the lib has no IAST for this scripture (e.g.
  // Sundarkand). Either way one form is shown — never both.
  const showIast = lang === 'en' && !!verse.iast;
  return (
    <View style={styles.verseBlock}>
      <Kicker color={palette.gold} size={9} withTrailingRule ruleColor={colors.divider}
        wrapperStyle={styles.verseKickerWrap}>
        {t('scripture.verseKicker', { num: index })}
      </Kicker>
      {showIast ? (
        <Text variant="body" style={[styles.verseIast, { color: colors.textPrimary }]}>
          {verse.iast}
        </Text>
      ) : (
        <Text variant="deva-bold" style={[styles.verseSanskrit, { color: colors.textPrimary }]}>
          {verse.devanagari}
        </Text>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

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
  headerCrumb: { flex: 1, fontSize: 13, lineHeight: 18, textAlign: 'center' },

  scroll: { paddingTop: 16, paddingBottom: 24 },

  // Chapter hero
  heroBlock: { alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },
  heroKicker: { letterSpacing: 2.6, marginBottom: 10 },
  heroTitle: { fontSize: 24, lineHeight: 32, textAlign: 'center' },
  heroVerseCount: { fontSize: 9, letterSpacing: 1.6, marginTop: 12 },
  heroOrnament: { marginTop: 14, width: '50%' },

  // Verse blocks
  verseBlock: {
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  verseKickerWrap: { marginBottom: 10 },
  verseSanskrit: {
    fontSize: 18,
    lineHeight: 30,
    textAlign: 'center',
  },
  verseIast: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },

  // Sources
  sourcesBlock: { marginTop: 12, gap: 8 },
  sourcesText: { fontSize: 12, lineHeight: 19 },

  // Empty / not-found
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});

