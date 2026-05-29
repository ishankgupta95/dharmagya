import { useMemo, useState } from 'react';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { AppText as Text, FONT_SCALE } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, palette, spacing, type ColorPalette } from '@/config/theme';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { FavoriteHeart } from '@/components/common/FavoriteHeart';
import { LangToggle } from '@/components/common/LangToggle';
import { useInterstitialOnExit } from '@/hooks/useInterstitialOnExit';
import { useEntranceStagger } from '@/hooks/useEntranceStagger';
import { useRefrainHighlight } from '@/hooks/useRefrainHighlight';
import { useShareSheet } from '@/store/useShareSheet';
import { shareAartiText } from '@/services/shareText';
import i18n, { resolveLanguage } from '@/i18n';
import { getAartiForDeity, aartiVerses, titleFor, type ContentLang } from '@/services/content';

const VERSE_STAGGER_MAX = 6;

export default function AartiDetailScreen() {
  useInterstitialOnExit();
  const { t } = useTranslation();
  // The route file is `[id].tsx` for backwards compat; the value is now a deity slug.
  const { id: deitySlug } = useLocalSearchParams<{ id: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const favoriteIds = useStore(s => s.favoriteIds);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const appLanguage = useStore(s => s.language);
  const colors = isDarkMode ? darkColors : lightColors;

  const aarti = useMemo(() => (deitySlug ? getAartiForDeity(deitySlug) : undefined), [deitySlug]);

  const [lang, setLang] = useState<ContentLang>(() => resolveLanguage(appLanguage));

  const fontSizeKey = useStore(s => s.fontSize);
  // Hero wrapper uses overflow:hidden for the scroll-collapse animation, so its
  // expanded height must grow with the user's font scale — otherwise xxl users
  // get the masthead clipped before it can render fully.
  const heroExpandedHeight = useMemo(() => Math.round(170 * FONT_SCALE[fontSizeKey]), [fontSizeKey]);

  const scrollY = useSharedValue(0);

  const COLLAPSE_END = 140;
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_END * 0.6], [1, 0], Extrapolation.CLAMP),
    maxHeight: interpolate(scrollY.value, [0, COLLAPSE_END], [heroExpandedHeight, 0], Extrapolation.CLAMP),
    overflow: 'hidden' as const,
  }));
  const compactTitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_END * 0.5, COLLAPSE_END], [0, 1], Extrapolation.CLAMP),
  }));

  const favoriteKey = `aarti-${deitySlug ?? ''}`;
  const isFavorite = favoriteIds.includes(favoriteKey);

  const verses = useMemo(() => (aarti ? aartiVerses(aarti, lang) : []), [aarti, lang]);
  const versesHi = useMemo(() => (aarti ? aartiVerses(aarti, 'hi') : []), [aarti]);
  const versesEn = useMemo(() => (aarti ? aartiVerses(aarti, 'en') : []), [aarti]);
  const refrainLines = useMemo(() => buildRefrainSet(verses[0] ?? ''), [verses]);

  // Masthead labels follow the in-screen lang toggle, not the global app
  // language — when the user flips ENGLISH/हिन्दी the title flips with it.
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

  if (!aarti) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={styles.notFoundWrap}>
          <Text variant="body-italic" style={[styles.notFoundText, { color: colors.textMuted }]}>
            {t('aarti.notFound')}
          </Text>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.notFoundBtn, { borderColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Text variant="mono-caps" style={[styles.notFoundBtnText, { color: colors.accent }]}>
              {t('common.back') ?? 'Back'}
            </Text>
          </MotionPressable>
        </View>
        {!aarti && deitySlug == null && <ActivityIndicator color={colors.accent} />}
      </SafeAreaView>
    );
  }

  const compactTitle = titleFor(aarti, lang);
  const deityDisplay = tForLang(`deities.${aarti.deity}.displayName`);
  const sectionLabel = tForLang('reader.aartiLabel');

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      {/* ── Header: back + compact-on-scroll title + favorite ───────────────── */}
      <View style={[styles.navRow, { borderBottomColor: colors.divider }]}>
        <MotionPressable
          onPress={() => router.back()}
          style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </MotionPressable>

        <Animated.View style={[styles.compactTitle, compactTitleAnimatedStyle]} pointerEvents="none">
          <Text variant="body-italic" style={[styles.compactTitleText, { color: colors.textPrimary }]} numberOfLines={1}>
            {compactTitle}
          </Text>
        </Animated.View>

        <View style={styles.navRightGroup}>
          <MotionPressable
            onPress={() => { void shareAartiText(aarti, lang); }}
            style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('share.a11yShareFullText')}>
            <Icon name="share" size={16} color={colors.textSecondary} />
          </MotionPressable>
          <FavoriteHeart
            active={isFavorite}
            onPress={() => toggleFavorite(favoriteKey)}
            size={16}
            inactiveColor={colors.textSecondary}
            activeColor={colors.accent}
            accessibilityLabel={t(isFavorite ? 'a11y.removeFavorite' : 'a11y.addFavorite')}
            style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          />
        </View>
      </View>

      <Animated.ScrollView
        style={{ backgroundColor: colors.base }}
        contentContainerStyle={[styles.bodyScroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}>

        {/* ── Editorial title block ─────────────────────────────────────────── */}
        <Animated.View style={[styles.heroBlock, heroAnimatedStyle]}>
          <Kicker color={colors.accent} size={11} style={styles.heroEyebrow}>
            {sectionLabel}
          </Kicker>
          <Kicker color={colors.accent} size={22} style={styles.heroTitle}>
            {deityDisplay}
          </Kicker>
          <Ornament variant="lotus" style={styles.heroRule} />
        </Animated.View>

        {/* ── Lang toggle ───────────────────────────────────────────────────── */}
        <LangToggle lang={lang} onChange={setLang} colors={colors} />

        {/* ── Verses ────────────────────────────────────────────────────────── */}
        {verses.map((verse, index) => (
          <VerseBlock
            key={index}
            verse={verse}
            verseNumber={romanNumeral(index + 1)}
            isFirstVerse={index === 0}
            refrainLines={refrainLines}
            lang={lang}
            colors={colors}
            t={t}
            deityId={aarti.deity}
            verseHi={versesHi[index] ?? verse}
            verseEn={versesEn[index]}
            sourceName={aarti.titleEnglish}
            entranceIndex={index}
            animateEntrance={index < VERSE_STAGGER_MAX}
          />
        ))}

        <Text variant="body-italic" style={[styles.verifyNote, { color: colors.textMuted }]}>
          {tForLang('reader.verifyNote')}
        </Text>

        <View style={{ height: 48 }} />
      </Animated.ScrollView>

    </SafeAreaView>
    </ScreenMount>
  );
}

interface VerseBlockProps {
  verse: string;
  verseNumber: string;
  isFirstVerse: boolean;
  refrainLines: Set<string>;
  lang: ContentLang;
  colors: ColorPalette;
  t: (key: string, opts?: Record<string, unknown>) => string;
  deityId: string;
  verseHi: string;
  verseEn?: string;
  sourceName: string;
  entranceIndex: number;
  animateEntrance: boolean;
}

function VerseBlock({
  verse, verseNumber, isFirstVerse, refrainLines, lang, colors, t,
  deityId, verseHi, verseEn, sourceName,
  entranceIndex, animateEntrance,
}: VerseBlockProps) {
  const staggerStyle = useEntranceStagger(entranceIndex, animateEntrance);
  const refrainStyle = useRefrainHighlight();
  const openShare = useShareSheet(s => s.open);
  const lines = verse.split('\n').filter(l => l.trim().length > 0);
  return (
    <Animated.View style={[styles.verseBlock, staggerStyle]}>
      <View style={styles.verseHeadRow}>
        <Kicker
          color={palette.gold}
          size={9}
          withTrailingRule
          ruleColor={colors.divider}
          wrapperStyle={[styles.verseKickerRow, styles.verseKickerFlex]}
          style={styles.verseKickerText}>
          {t('reader.verseLabel', { num: verseNumber })}
          {isFirstVerse && ` · ${t('reader.refrainTag')}`}
        </Kicker>
        <MotionPressable
          onPress={() => openShare({ kind: 'verse', deityId, verseHi, verseEn, sourceLabel: t('share.from', { name: sourceName }) })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('share.ctaVerse')}>
          <Icon name="share" size={14} color={colors.textMuted} />
        </MotionPressable>
      </View>
      {lines.map((line, idx) => {
        const isRefrain = refrainLines.has(normalize(line));
        const textNode = lang === 'hi' ? (
          <Text
            variant={isRefrain ? 'deva-bold' : 'deva'}
            style={[
              styles.verseDeva,
              { color: isRefrain ? colors.emphasis : colors.textPrimary },
              isRefrain && styles.verseDevaRefrain,
            ]}>
            {line}
          </Text>
        ) : (
          <Text
            variant="body-italic"
            style={[
              styles.verseTranslit,
              { color: isRefrain ? colors.emphasis : colors.textSecondary },
              isRefrain && styles.verseTranslitRefrain,
            ]}>
            {line}
          </Text>
        );
        if (isRefrain) {
          return (
            <Animated.View key={idx} style={refrainStyle}>
              {textNode}
            </Animated.View>
          );
        }
        return <View key={idx}>{textNode}</View>;
      })}
    </Animated.View>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
// Refrain detection: aartis traditionally open with a refrain (the first verse)
// that repeats between stanzas. Data carries no refrain flag, so we build the
// set of lines from the first verse and mark any later line that matches.
function buildRefrainSet(firstVerse: string): Set<string> {
  const set = new Set<string>();
  for (const line of firstVerse.split('\n')) {
    const n = normalize(line);
    if (n.length > 0) set.add(n);
  }
  return set;
}

function normalize(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
function romanNumeral(n: number): string {
  return ROMAN[n - 1] ?? String(n);
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
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
  navRightGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactTitle: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  compactTitleText: {
    fontSize: 15,
    textAlign: 'center',
  },

  bodyScroll: { paddingTop: 20, paddingBottom: 32 },

  // Editorial masthead — small mono-caps eyebrow ("AARTI") sits above the
  // deity name set as the actual title. Both sindoor red, both mono-caps;
  // hierarchy comes from size + tracking, not color or weight.
  heroBlock: {
    alignItems: 'center',
    marginBottom: 22,
    paddingTop: 8,
  },
  heroEyebrow: {
    letterSpacing: 4.0,
    textAlign: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    lineHeight: 32,
    letterSpacing: 2.8,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  heroRule: {
    marginTop: 20,
    width: '60%',
  },

  // Verses
  verseBlock: { marginBottom: 22 },
  verifyNote: { fontSize: 11.5, lineHeight: 17, marginTop: 8, textAlign: 'center' },
  verseHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verseKickerRow: { marginBottom: 10 },
  verseKickerFlex: { flex: 1 },
  verseKickerText: { letterSpacing: 2.4 },
  verseDeva: {
    fontSize: 18.5,
    lineHeight: 29,
    textAlign: 'left',
  },
  verseDevaRefrain: {
    fontFamily: 'NotoSerifDevanagari_700Bold',
  },
  verseTranslit: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'left',
  },
  verseTranslitRefrain: {
    fontFamily: 'Fraunces_400Regular_Italic',
  },

  // Not-found
  notFoundWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 40 },
  notFoundText: { fontSize: 15, textAlign: 'center' },
  notFoundBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  notFoundBtnText: { fontSize: 10 },
});
