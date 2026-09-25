import { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, deityColors, palette, spacing } from '@/config/theme';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { LangToggle, type ContentLang } from '@/components/common/LangToggle';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import i18n, { resolveLanguage } from '@/i18n';

import { MotionPressable } from '@/components/common/MotionPressable';
import { FavoriteHeart } from '@/components/common/FavoriteHeart';
import {
  NAVRATRI_SOURCES,
  SAPTASHATI_ABOUT,
  SAPTASHATI_CHAPTERS,
  SAPTASHATI_DAY_MAP,
  SAPTASHATI_DAY_MAP_CAPTION,
} from '@/config/navratri';
import {
  getScriptureBySlug,
  SCRIPTURE_DISCLAIMER,
  type Scripture,
} from '@/config/scriptures';

type Lang = ContentLang;

/**
 * Scripture detail — dispatches to one of three screens:
 *   • Durga Saptashati outline + 9-day pāṭha map (no verses; sourced from
 *     `@/config/navratri`).
 *   • Library scriptures from `hindu-devotional-texts` (Bhagavad Geeta,
 *     Sundarkand) — hero + About + chapter list (Geeta) or a single
 *     "Read all verses" CTA (Sundarkand, which is a single-chapter scripture).
 *   • A not-found screen if the id matches neither.
 */
export default function ScriptureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (id === 'durga-saptashati') return <SaptashatiOutlineScreen />;

  const scripture = getScriptureBySlug(id);
  if (scripture) return <LibraryScriptureDetailScreen scripture={scripture} />;

  return <ScriptureNotFoundScreen />;
}

// ─── Saptashati outline (unchanged from P14.3) ──────────────────────────────

function SaptashatiOutlineScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';
  const appLanguage = useStore(s => s.language);

  const [lang, setLang] = useState<Lang>(() => resolveLanguage(appLanguage));
  // Chrome (kickers, "About this text", "9-day pāṭha schedule", etc.) follows
  // the in-screen toggle — same pattern as aarti/chalisa.
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

  const dayMap = useMemo(() => SAPTASHATI_DAY_MAP, []);
  const chapters = useMemo(() => SAPTASHATI_CHAPTERS, []);

  const titleByLang: Record<Lang, string> = {
    en: 'Durga Saptashati',
    hi: 'दुर्गा सप्तशती',
  };
  const subtitleByLang: Record<Lang, string> = {
    en: 'Devi Mahatmya · 13 chapters · 700 verses',
    hi: 'देवी माहात्म्य · त्रयोदश अध्याय · सात सौ श्लोक',
  };

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={[styles.navRow, { borderBottomColor: colors.divider }]}>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </MotionPressable>
          <View style={[styles.navPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          style={{ backgroundColor: colors.base }}
          contentContainerStyle={[styles.bodyScroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Editorial title block ──────────────────────────────────── */}
          <View style={styles.heroBlock}>
            <Kicker color={colors.accent} size={11} style={styles.heroEyebrow}>
              {tForLang('scripture.kickerSaptashati')}
            </Kicker>
            <Kicker color={colors.accent} size={22} style={styles.heroTitle}>
              {titleByLang[lang]}
            </Kicker>
            <Text variant="body-italic" style={[styles.heroSubtitle, { color: colors.textTertiary }]}>
              {subtitleByLang[lang]}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.heroRule} />
          </View>

          {/* ── Lang toggle (shared component) ──────────────────────────── */}
          <LangToggle lang={lang} onChange={setLang} colors={colors} />

          {/* ── About — what the Saptashati is ──────────────────────────── */}
          <View style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Kicker color={colors.accent} size={10}>{tForLang('scripture.aboutLabel')}</Kicker>
            <Text variant="body" style={[styles.aboutText, { color: colors.textSecondary }]}>
              {SAPTASHATI_ABOUT[lang]}
            </Text>
            <Text variant="body-italic" style={[styles.aboutReviewNote, { color: colors.textSecondary }]}>
              {tForLang('scripture.reviewNote')}
            </Text>
          </View>

          {/* ── 9-day chapter map ───────────────────────────────────────── */}
          <View style={styles.section}>
            <Kicker color={colors.accent} size={10} style={styles.sectionKicker}>
              {tForLang('scripture.dayMapLabel')}
            </Kicker>
            <Text variant="body-italic" style={[styles.dayMapCaption, { color: colors.textTertiary }]}>
              {SAPTASHATI_DAY_MAP_CAPTION[lang]}
            </Text>
            {dayMap.map(entry => (
              <View
                key={entry.day}
                style={[styles.dayMapRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.dayNumCol, { borderRightColor: colors.divider }]}>
                  <Text variant="mono-caps" style={[styles.dayNumKicker, { color: colors.textMuted }]}>
                    {tForLang('navratri.dayShortLabel')}
                  </Text>
                  <Text variant="display-italic" style={[styles.dayNum, { color: colors.textPrimary }]}>
                    {String(entry.day)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="body" style={[styles.dayMapChapters, { color: colors.textPrimary }]}>
                    {tForLang('scripture.chaptersN', {
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
              {tForLang('scripture.chaptersLabel')}
            </Kicker>
            {chapters.map(ch => (
              <View
                key={ch.number}
                style={[styles.chapterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.chapterHead}>
                  <Kicker color={colors.accentText} size={9} withTrailingRule ruleColor={colors.divider}
                    wrapperStyle={styles.chapterKickerWrap}>
                    {tForLang('scripture.chapterKicker', { num: ch.number })}
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
            <Kicker color={colors.textMuted} size={9}>{tForLang('navratri.sourcesLabel')}</Kicker>
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

// ─── Library-scripture detail (Geeta / Sundarkand) ──────────────────────────

function LibraryScriptureDetailScreen({ scripture }: { scripture: Scripture }) {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const appLanguage = useStore(s => s.language);

  // In-screen LangToggle mirrors the aarti / chalisa / Saptashati pattern —
  // chrome (kickers, labels, CTAs) and content (hero title, About, chapter
  // titles) both follow the toggle, not the global app language.
  const [lang, setLang] = useState<Lang>(() => resolveLanguage(appLanguage));
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

  const favoriteIds = useStore(s => s.favoriteIds);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const readingPositions = useStore(s => s.readingPositions);
  const favKey = `scripture-${scripture.slug}`;
  const isFavorite = favoriteIds.includes(favKey);

  const isSingleChapter = scripture.chapters.length === 1;
  const totalVerses = useMemo(
    () => scripture.chapters.reduce((n, ch) => n + ch.verses.length, 0),
    [scripture],
  );

  // Per-chapter progress from the reader's `scripture-<slug>-<n>` keys
  // (frame 21): each chapter is its own achievable thing, so there is no
  // overall bar. `furthest` is the furthest-read verse index; a chapter is
  // complete once the reader reached its last verse.
  const progressFor = (chapterNumber: number, verseCount: number) => {
    const furthest = readingPositions[`scripture-${scripture.slug}-${chapterNumber}`];
    if (furthest == null || verseCount === 0) return { started: false, complete: false, fraction: 0, furthest: 0 };
    const complete = furthest >= verseCount - 1;
    return {
      started: furthest > 0,
      complete,
      fraction: verseCount > 1 ? Math.min(1, furthest / (verseCount - 1)) : 1,
      furthest,
    };
  };

  // Continue card — the chapter the reader last left, rolled to the next
  // chapter once one completes.
  //
  // Deliberately NOT wrapped in useMemo: the React Compiler could not preserve
  // the manual memoization here (the `let best` accumulator reassigned inside a
  // loop defeats its equivalence check), so it bailed out of memoizing this
  // component entirely — the hand-written memo cost more than it bought. As a
  // plain expression over `scripture.chapters` + `readingPositions` the compiler
  // memoizes it automatically, and the work itself is a cheap object lookup per
  // chapter. Kept as an IIFE so the early-return control flow reads unchanged.
  const continueTarget = ((): { chapterNumber: number; furthest: number; verseCount: number } | null => {
    let best: { chapterNumber: number; furthest: number; verseCount: number } | null = null;
    for (const ch of scripture.chapters) {
      const furthest = readingPositions[`scripture-${scripture.slug}-${ch.number}`];
      if (furthest == null) continue;
      const complete = furthest >= ch.verses.length - 1;
      if (!complete) {
        if (!best || ch.number > best.chapterNumber) {
          best = { chapterNumber: ch.number, furthest, verseCount: ch.verses.length };
        }
      }
    }
    if (best) return best;
    // Everything read so far is complete — offer the first unread chapter.
    for (const ch of scripture.chapters) {
      if (readingPositions[`scripture-${scripture.slug}-${ch.number}`] == null) {
        return { chapterNumber: ch.number, furthest: 0, verseCount: ch.verses.length };
      }
    }
    return null;
  })();
  const hasAnyProgress = scripture.chapters.some(
    ch => readingPositions[`scripture-${scripture.slug}-${ch.number}`] != null,
  );

  const openChapter = (chapterNumber: number) =>
    router.push({
      pathname: '/scripture/[id]/[chapter]',
      params: { id: scripture.slug, chapter: String(chapterNumber) },
    });

  const washHue = (scripture.deity && deityColors[scripture.deity]) || palette.turmeric;

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <LinearGradient
          colors={
            isDarkMode
              ? ([`${washHue}42`, `${palette.night}00`] as const)
              : ([`${washHue}2E`, `${palette.rice}00`] as const)
          }
          locations={[0, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.wash}
          pointerEvents="none"
        />

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={styles.navRowPlain}>
          <MotionPressable
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={22} color={colors.textPrimary} />
          </MotionPressable>
          <FavoriteHeart
            active={isFavorite}
            onPress={() => toggleFavorite(favKey)}
            size={20}
            inactiveColor={colors.textMuted}
            activeColor={colors.accent}
            accessibilityLabel={t(isFavorite ? 'a11y.removeFavorite' : 'a11y.addFavorite')}
          />
        </View>

        <ScrollView
          contentContainerStyle={[styles.bodyScroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Title block ──────────────────────────────────────────────── */}
          <Text variant="deva-bold" style={[styles.libHeroDeva, { color: colors.textPrimary }]}>
            {scripture.titleHindi}
          </Text>
          <Text variant="display" style={[styles.libHeroLatin, { color: colors.textSecondary }]}>
            {scripture.titleEnglish}
          </Text>
          <Text variant="mono" style={[styles.libHeroMeta, { color: colors.textTertiary }]}>
            {isSingleChapter
              ? tForLang('scripture.subtitleVersesOnly', { count: totalVerses })
              : tForLang('scripture.subtitleChaptersVerses', {
                  chapters: scripture.chapters.length,
                  verses: totalVerses,
                })}
          </Text>

          <View style={styles.langToggleWrap}>
            <LangToggle lang={lang} onChange={setLang} colors={colors} />
          </View>

          {/* ── Continue card ────────────────────────────────────────────── */}
          {hasAnyProgress && continueTarget && (
            <MotionPressable
              onPress={() => openChapter(continueTarget.chapterNumber)}
              pressedScale={0.97}
              style={[styles.continueCard, { backgroundColor: colors.surfaceAccent, borderColor: colors.borderAccent }]}
              accessibilityRole="button"
              accessibilityLabel={tForLang('scripture.continueChapter', { num: continueTarget.chapterNumber })}>
              <Icon name="text" size={19} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text variant="title" style={[styles.continueTitle, { color: colors.textPrimary }]}>
                  {tForLang('scripture.continueChapter', { num: continueTarget.chapterNumber })}
                </Text>
                <Text variant="mono" style={[styles.continueMeta, { color: colors.textTertiary }]}>
                  {tForLang('scripture.verseOf', {
                    x: continueTarget.furthest + 1,
                    y: continueTarget.verseCount,
                  })}
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color={colors.accent} />
            </MotionPressable>
          )}

          {/* ── About ───────────────────────────────────────────────────── */}
          {scripture.about[lang].trim().length > 0 && (
            <View style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text variant="kicker-small" style={[styles.cardKicker, { color: colors.accentText }]}>
                {tForLang('scripture.aboutLabel')}
              </Text>
              <Text variant="body" style={[styles.aboutText, { color: colors.textSecondary }]}>
                {scripture.about[lang]}
              </Text>
            </View>
          )}

          {/* ── Read CTA (single-chapter scriptures) OR chapter list ────── */}
          {isSingleChapter ? (
            <MotionPressable
              onPress={() => openChapter(scripture.chapters[0].number)}
              pressedScale={0.97}
              style={[styles.readCta, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}
              accessibilityRole="button"
              accessibilityLabel={tForLang('scripture.readAllVerses', { count: totalVerses })}>
              <View style={{ flex: 1 }}>
                <Text variant="kicker-small" style={[styles.readCtaKicker, { color: colors.accentText }]}>
                  {tForLang('scripture.readCtaKicker')}
                </Text>
                <Text variant="body" style={[styles.readCtaText, { color: colors.textPrimary }]}>
                  {tForLang('scripture.readAllVerses', { count: totalVerses })}
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color={colors.accent} />
            </MotionPressable>
          ) : (
            <View style={styles.section}>
              <Text variant="kicker-small" style={[styles.sectionKickerText, { color: colors.textMuted }]}>
                {tForLang('scripture.chapterListLabel')}
              </Text>
              <View style={[styles.chapterListCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {scripture.chapters.map((ch, i) => {
                  const progress = progressFor(ch.number, ch.verses.length);
                  const inProgress = progress.started && !progress.complete;
                  return (
                    <View key={ch.number}>
                      {i > 0 && <View style={[styles.chapterDivider, { backgroundColor: colors.divider }]} />}
                      <MotionPressable
                        onPress={() => openChapter(ch.number)}
                        pressedScale={0.98}
                        style={[styles.chapterRow, inProgress && { backgroundColor: colors.accentSurface }]}
                        accessibilityRole="button"
                        accessibilityLabel={tForLang('scripture.a11yOpenChapter', { num: ch.number })}>
                        <Text
                          variant="display"
                          style={[
                            styles.chapterNum,
                            { color: inProgress ? colors.accentText : colors.textMuted },
                          ]}>
                          {ch.number}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            variant={lang === 'hi' ? 'deva' : 'body'}
                            style={[styles.chapterRowTitle, { color: colors.textPrimary }]}
                            numberOfLines={1}>
                            {lang === 'hi' ? (ch.titleSanskrit ?? ch.titleEnglish ?? '') : (ch.titleEnglish ?? ch.titleSanskrit ?? '')}
                          </Text>
                          {inProgress ? (
                            <View style={[styles.chapterBar, { backgroundColor: isDarkMode ? 'rgba(237,232,240,0.14)' : 'rgba(34,27,36,0.10)' }]}>
                              <View
                                style={[
                                  styles.chapterBarFill,
                                  { backgroundColor: colors.accent, width: `${Math.round(progress.fraction * 100)}%` },
                                ]}
                              />
                            </View>
                          ) : (
                            <Text variant="body-small" style={[styles.chapterRowCaption, { color: colors.textMuted }]}>
                              {tForLang('scripture.versesNCount', { count: ch.verses.length })}
                              {progress.complete ? ` · ${tForLang('scripture.chapterComplete')}` : ''}
                            </Text>
                          )}
                        </View>
                        {progress.complete && <Icon name="check-circle" size={17} color={colors.accent} />}
                      </MotionPressable>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Sources / disclaimer ──────────────────────────────────── */}
          <View style={styles.sourcesBlock}>
            <Text variant="kicker-small" style={{ color: colors.textMuted, fontSize: 9 }}>
              {tForLang('scripture.sourcesLabel')}
            </Text>
            <Text variant="body-small" style={[styles.sourcesText, { color: colors.textMuted }]}>
              {SCRIPTURE_DISCLAIMER[lang]}
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Not-found ──────────────────────────────────────────────────────────────

function ScriptureNotFoundScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      <View style={styles.notFoundWrap}>
        <Text variant="body-italic" style={[styles.notFoundText, { color: colors.textMuted }]}>
          {t('scripture.notFound')}
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
    </SafeAreaView>
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
  navRowPlain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenH,
    paddingTop: 8,
    paddingBottom: 8,
  },
  wash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 280,
  },

  // Diya title block (library scriptures)
  libHeroDeva: { fontSize: 32, lineHeight: 44, marginTop: 14 },
  libHeroLatin: { fontSize: 22, lineHeight: 28, marginTop: 2 },
  libHeroMeta: { fontSize: 13.5, lineHeight: 19, marginTop: 10 },
  langToggleWrap: { marginTop: 16 },

  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: borderRadius.list,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 15,
    marginBottom: spacing.cardGap,
  },
  continueTitle: { fontSize: 15, lineHeight: 20 },
  continueMeta: { fontSize: 12.5, marginTop: 2 },

  cardKicker: { fontSize: 9.5 },
  sectionKickerText: { fontSize: 9.5, marginBottom: 10, paddingHorizontal: 4 },

  chapterListCard: {
    borderRadius: borderRadius.list,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chapterDivider: { height: StyleSheet.hairlineWidth, marginLeft: 57 },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 17,
  },
  chapterNum: { fontSize: 21, lineHeight: 26, minWidth: 26, textAlign: 'left' },
  chapterRowTitle: { fontSize: 16, lineHeight: 22 },
  chapterRowCaption: { fontSize: 12, marginTop: 1 },
  chapterBar: { height: 3, borderRadius: 2, marginTop: 7, overflow: 'hidden' },
  chapterBarFill: { height: '100%', borderRadius: 2 },

  bodyScroll: { paddingTop: 20, paddingBottom: 32 },

  // Editorial masthead
  heroBlock: { alignItems: 'center', marginBottom: 22, paddingTop: 8 },
  heroEyebrow: { letterSpacing: 4.0, textAlign: 'center', marginBottom: 12 },
  heroTitle: { lineHeight: 32, letterSpacing: 2.8, textAlign: 'center', paddingHorizontal: 12 },
  libHeroTitle: { fontSize: 28, lineHeight: 36, textAlign: 'center', paddingHorizontal: 12 },
  heroSubtitle: { fontSize: 13, lineHeight: 19, marginTop: 10, textAlign: 'center' },
  heroRule: { marginTop: 16, width: '60%' },

  // About block
  aboutCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
    marginBottom: spacing.cardGap,
  },
  aboutText: { fontSize: 14, lineHeight: 22, marginTop: 10 },
  aboutReviewNote: { fontSize: 11.5, lineHeight: 17, marginTop: 12 },

  // Read-CTA (single-chapter scriptures)
  readCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.cardPadLg,
    paddingVertical: 16,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    marginBottom: spacing.cardGap,
  },
  readCtaKicker: { fontSize: 9, letterSpacing: 1.6 },
  readCtaText: { fontSize: 15.5, lineHeight: 22, marginTop: 4 },

  // Section
  section: { marginBottom: 8 },
  sectionKicker: { marginBottom: 12 },

  // Day map
  dayMapCaption: { fontSize: 12.5, lineHeight: 19, marginBottom: 12, marginTop: -4 },
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

  // Chapter card
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
  chapterVerseCount: { fontSize: 9, letterSpacing: 1.4, marginTop: 10 },

  // Sources
  sourcesBlock: { marginTop: 4, gap: 8 },
  sourcesText: { fontSize: 12, lineHeight: 19 },

  // Not-found
  notFoundWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 40 },
  notFoundText: { fontSize: 15, textAlign: 'center' },
  notFoundBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  notFoundBtnText: { fontSize: 10 },
});
