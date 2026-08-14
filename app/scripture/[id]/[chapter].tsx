import { useMemo, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
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

import { MotionPressable } from '@/components/common/MotionPressable';
import {
  getScriptureBySlug,
  SCRIPTURE_DISCLAIMER,
  type Chapter,
  type ScriptureVerse,
} from '@/config/scriptures';

type Lang = ContentLang;

/**
 * Scripture verse reader — one chapter at a time. Reads `id` + `chapter` from
 * the route, resolves the scripture and chapter, and renders each verse with a
 * single script per toggle mode (so nothing is shown twice): Hindi mode = the
 * Devanagari shloka + Hindi bhāvārtha; English mode = the IAST transliteration
 * + English translation. The meaning sits in its own MEANING block below the
 * shloka. Geeta + Sundarkand both carry all four fields for every verse.
 */
export default function ScriptureChapterScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';
  const appLanguage = useStore((s) => s.language);

  // The in-screen toggle selects the MEANING language (English translation vs
  // Hindi bhāvārtha). Devanagari + IAST are always shown regardless. Defaults
  // to the app language.
  const [lang, setLang] = useState<Lang>(() => resolveLanguage(appLanguage));
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

  const { id, chapter } = useLocalSearchParams<{ id?: string; chapter?: string }>();
  const scripture = useMemo(() => getScriptureBySlug(id), [id]);
  const chapterNum = chapter ? parseInt(chapter, 10) : NaN;
  const chapterData: Chapter | undefined = useMemo(() => {
    if (!scripture || !Number.isFinite(chapterNum)) return undefined;
    return scripture.chapters.find((c) => c.number === chapterNum);
  }, [scripture, chapterNum]);

  // Adjacent-chapter navigation: only show in scriptures with >1 chapter
  // (Sundarkand has one, Geeta has 18). The chapter list is in registry order,
  // so find current index then peek ±1.
  const { prevChapter, nextChapter } = useMemo(() => {
    if (!scripture || !chapterData) return { prevChapter: null, nextChapter: null };
    const idx = scripture.chapters.findIndex((c) => c.number === chapterData.number);
    return {
      prevChapter: idx > 0 ? scripture.chapters[idx - 1] : null,
      nextChapter: idx >= 0 && idx < scripture.chapters.length - 1 ? scripture.chapters[idx + 1] : null,
    };
  }, [scripture, chapterData]);

  // Per-chapter reading progress (frame 21). The furthest-scrolled verse is
  // approximated from the scroll fraction and stored under
  // `scripture-<slug>-<chapter>`; it only ever advances, so re-reading the top
  // of a chapter never loses progress. The detail screen renders it as the
  // per-chapter bar + the Continue card.
  const setReadingPosition = useStore((s) => s.setReadingPosition);
  const positionKey = scripture && chapterData ? `scripture-${scripture.slug}-${chapterData.number}` : null;
  const verseCount = chapterData?.verses.length ?? 0;
  const furthestRef = useRef(-1);
  const handleScrollProgress = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!positionKey || verseCount === 0) return;
    if (furthestRef.current < 0) {
      furthestRef.current = useStore.getState().readingPositions[positionKey] ?? 0;
    }
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const scrollable = contentSize.height - layoutMeasurement.height;
    const fraction = scrollable > 0 ? Math.min(1, Math.max(0, contentOffset.y / scrollable)) : 1;
    const index = Math.round(fraction * (verseCount - 1));
    if (index > furthestRef.current) {
      furthestRef.current = index;
      setReadingPosition(positionKey, index);
    }
  };

  if (!scripture || !chapterData) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </MotionPressable>
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
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </MotionPressable>
          <Text variant="body-italic" style={[styles.headerCrumb, { color: colors.textTertiary }]} numberOfLines={1}>
            {scriptureTitle}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          onScroll={handleScrollProgress}
          scrollEventThrottle={250}
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

          {/* ── Chapter navigation ──────────────────────────────────────── */}
          {(prevChapter || nextChapter) && (
            <View style={styles.chapterNav}>
              {prevChapter ? (
                <MotionPressable
                  pressedScale={0.97}
                  onPress={() => router.replace({
                    pathname: '/scripture/[id]/[chapter]',
                    params: { id: scripture.slug, chapter: String(prevChapter.number) },
                  })}
                  style={[styles.chapterNavBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={tForLang('scripture.prevChapterA11y', { num: prevChapter.number })}>
                  <Icon name="chevron-left" size={14} color={colors.accent} />
                  <View style={styles.chapterNavTextWrap}>
                    <Text variant="mono-caps" style={[styles.chapterNavKicker, { color: colors.textMuted }]}>
                      {tForLang('scripture.prevChapter')}
                    </Text>
                    <Text variant="body-italic" style={[styles.chapterNavTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {tForLang('scripture.chapterKicker', { num: prevChapter.number })}
                    </Text>
                  </View>
                </MotionPressable>
              ) : (
                <View style={styles.chapterNavSpacer} />
              )}
              {nextChapter ? (
                <MotionPressable
                  pressedScale={0.97}
                  onPress={() => router.replace({
                    pathname: '/scripture/[id]/[chapter]',
                    params: { id: scripture.slug, chapter: String(nextChapter.number) },
                  })}
                  style={[styles.chapterNavBtn, styles.chapterNavBtnNext, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={tForLang('scripture.nextChapterA11y', { num: nextChapter.number })}>
                  <View style={[styles.chapterNavTextWrap, { alignItems: 'flex-end' }]}>
                    <Text variant="mono-caps" style={[styles.chapterNavKicker, { color: colors.textMuted }]}>
                      {tForLang('scripture.nextChapter')}
                    </Text>
                    <Text variant="body-italic" style={[styles.chapterNavTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {tForLang('scripture.chapterKicker', { num: nextChapter.number })}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={14} color={colors.accent} />
                </MotionPressable>
              ) : (
                <View style={styles.chapterNavSpacer} />
              )}
            </View>
          )}

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
  // One script per mode — the toggle picks the whole verse's script, so no line
  // is ever shown twice. Hindi: Devanagari shloka + Hindi bhāvārtha. English:
  // IAST transliteration + English translation. IAST falls back to Devanagari
  // if a scripture lacks it; meaning falls back to the other language.
  const isHi = lang === 'hi';
  const meaning = isHi ? (verse.hindi ?? verse.english) : (verse.english ?? verse.hindi);
  const showDevaShloka = isHi || !verse.iast;
  return (
    <View style={styles.verseBlock}>
      <Kicker color={palette.gold} size={9} withTrailingRule ruleColor={colors.divider}
        wrapperStyle={styles.verseKickerWrap}>
        {t('scripture.verseKicker', { num: index })}
      </Kicker>
      {showDevaShloka ? (
        <Text variant="deva-bold" style={[styles.verseSanskrit, { color: colors.textPrimary }]}>
          {verse.devanagari}
        </Text>
      ) : (
        <Text variant="body-italic" style={[styles.verseIast, { color: colors.textPrimary }]}>
          {verse.iast}
        </Text>
      )}
      {!!meaning && (
        <View style={[styles.meaningBlock, { borderLeftColor: colors.borderAccent }]}>
          <Kicker color={colors.accent} size={8} style={styles.meaningLabel}>
            {t('scripture.meaningLabel')}
          </Kicker>
          {/* Hindi bhāvārtha is Devanagari prose → `deva`; English is Latin →
              `body`. (Matches the katha reader's prose-by-script convention.) */}
          <Text
            variant={isHi ? 'deva' : 'body'}
            style={[styles.meaningText, { color: colors.textSecondary }]}>
            {meaning}
          </Text>
        </View>
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
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
  },
  // Meaning sits in a left-ruled block so it reads as commentary, distinct
  // from the centered recitation lines above it.
  meaningBlock: {
    marginTop: 16,
    paddingLeft: 14,
    borderLeftWidth: 2,
  },
  meaningLabel: { letterSpacing: 2.0, marginBottom: 6 },
  meaningText: {
    fontSize: 14.5,
    lineHeight: 23,
    textAlign: 'left',
  },

  // Sources
  sourcesBlock: { marginTop: 12, gap: 8 },
  sourcesText: { fontSize: 12, lineHeight: 19 },

  chapterNav: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    marginBottom: 8,
  },
  chapterNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  chapterNavBtnNext: {
    justifyContent: 'flex-end',
  },
  chapterNavSpacer: { flex: 1 },
  chapterNavTextWrap: { flex: 1 },
  chapterNavKicker: { fontSize: 8.5, letterSpacing: 1.4 },
  chapterNavTitle: { fontSize: 14, marginTop: 3 },

  // Empty / not-found
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});

