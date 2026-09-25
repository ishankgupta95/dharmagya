import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, View, StyleSheet, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, spacing } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { LangToggle, type ContentLang } from '@/components/common/LangToggle';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { VerseBlock } from '@/components/reader/VerseBlock';
import { handleReaderTouchStart } from '@/components/reader/CopyableUnit';
import i18n, { resolveLanguage } from '@/i18n';

import { MotionPressable } from '@/components/common/MotionPressable';
import {
  getScriptureBySlug,
  SCRIPTURE_DISCLAIMER,
  type Chapter,
} from '@/config/scriptures';

type Lang = ContentLang;

/** Module-level so its identity never changes — VirtualizedList refuses to
 *  accept a new `viewabilityConfig` / `onViewableItemsChanged` after mount. */
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 30 };

/** How far (px) the list must move from its initial offset before a non-drag
 *  scroll counts as "the reader actually scrolled" for progress tracking. */
const SCROLL_GATE_PX = 24;

/**
 * Scripture verse reader — one chapter at a time. Reads `id` + `chapter` from
 * the route, resolves the scripture and chapter, and renders each verse with a
 * single script per toggle mode (so nothing is shown twice): Hindi mode = the
 * Devanagari shloka + Hindi bhāvārtha; English mode = the IAST transliteration
 * + English translation. The meaning sits in its own MEANING block below the
 * shloka. Geeta + Sundarkand both carry all four fields for every verse.
 * Verses render through the shared `VerseBlock`, which also carries the
 * long-press copy (Devanagari + meaning in the toggle's language).
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

  // Per-chapter reading progress (frame 21). Stored under
  // `scripture-<slug>-<chapter>`; it only ever advances, so re-reading the top
  // of a chapter never loses progress. The detail screen renders it as the
  // per-chapter bar + the Continue card.
  //
  // The index comes from `onViewableItemsChanged`, NOT from the scroll offset:
  // under virtualization `contentSize` is an estimate that keeps shifting as
  // rows are measured, so an offset/height fraction would drift. Viewability
  // reports the real row indices.
  //
  // Writes are batched to scroll-end. The 361-verse chapters would otherwise
  // persist the store hundreds of times in a single read, each one allocating
  // a fresh `readingPositions` object and waking every subscriber.
  // `furthestRef` is the live high-water mark; `committedRef` is how much of it
  // has actually been written.
  const positionKey = scripture && chapterData ? `scripture-${scripture.slug}-${chapterData.number}` : null;
  const furthestRef = useRef(-1);
  const committedRef = useRef(-1);
  const positionKeyRef = useRef(positionKey);
  // The old offset-driven handler could not fire without a scroll, so merely
  // opening a chapter never touched `lastReadKey`. Viewability DOES fire on
  // first layout, so without this gate a mis-tap into a chapter would steal the
  // Library "Continue" card on the way back out. The gate opens on any real
  // scroll movement: a touch drag (`onScrollBeginDrag`), or — because that
  // event only fires for finger drags — an `onScroll` whose offset has moved
  // more than `SCROLL_GATE_PX` from the top. The second path is what VoiceOver
  // three-finger page scrolls, TalkBack scroll actions, hardware-keyboard /
  // Full Keyboard Access scrolling and programmatic scrolls go through.
  const hasScrolledRef = useRef(false);

  // Both callbacks close over refs and the store singleton only, so a lazy
  // `useState` initializer pins their identity for the life of the screen —
  // required by VirtualizedList, which refuses a changed
  // `onViewableItemsChanged`, and it lets the commit run from effect cleanup.
  // (A ref would do the same but can't be read during render.)
  const [handleViewableItemsChanged] = useState(() => ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const key = positionKeyRef.current;
    if (!key) return;
    if (furthestRef.current < 0) {
      // Seed from what's already stored so scrolling near the top of a
      // part-read chapter never walks progress backwards.
      const stored = useStore.getState().readingPositions[key] ?? 0;
      furthestRef.current = stored;
      committedRef.current = stored;
    }
    let max = furthestRef.current;
    for (const token of viewableItems) {
      // Header/footer cells come through with a null index.
      if (token.index != null && token.index > max) max = token.index;
    }
    furthestRef.current = max;
  });

  const [commitProgress] = useState(() => () => {
    const key = positionKeyRef.current;
    if (!key || !hasScrolledRef.current) return;
    const index = furthestRef.current;
    if (index < 0 || index <= committedRef.current) return;
    committedRef.current = index;
    useStore.getState().setReadingPosition(key, index);
  });

  // Chapter nav uses router.replace, so this screen is reused across chapters:
  // flush the outgoing chapter's progress in cleanup, then reset for the new
  // key. The same cleanup covers unmount (back out of the reader mid-chapter).
  useEffect(() => {
    positionKeyRef.current = positionKey;
    furthestRef.current = -1;
    committedRef.current = -1;
    hasScrolledRef.current = false;
    return () => { commitProgress(); };
  }, [positionKey, commitProgress]);

  // Backgrounding the app is the other way out of a read that never fires a
  // scroll-end we'd see.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') commitProgress();
    });
    return () => sub.remove();
  }, [commitProgress]);

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
  // Screen-reader chrome, so the app language (`t`), as for the back button.
  const copyLabel = t('reader.copyAction');

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

        {/* Virtualized: Ramcharitmanas kands run 120–360 verses of Devanagari,
            and laying every one of them out up front costs seconds of
            complex-script shaping before the first frame. No `getItemLayout`;
            verse heights vary far too much. `removeClippedSubviews` is left at
            FlatList's default, which is ON for Android (off on iOS): rendered
            cells that scroll off screen are detached from the native view tree.
            This list has always shipped that way on Android, and fast flings
            through long chapters and namavalis render every row on the API 36
            emulator, so it is kept for the lighter native tree on low-end
            phones. */}
        <FlatList
          data={chapterData.verses}
          // Verses carry no id and the chapter array is static, so the index
          // is the verse number (index + 1).
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          viewabilityConfig={VIEWABILITY_CONFIG}
          onViewableItemsChanged={handleViewableItemsChanged}
          onScrollBeginDrag={() => { hasScrolledRef.current = true; }}
          // Any touch outside a long-pressed verse ends its text-selection mode.
          onTouchStart={handleReaderTouchStart}
          // Non-drag scrolls (screen readers, keyboard, programmatic) never
          // fire `onScrollBeginDrag`, so also open the gate once the offset has
          // moved past the threshold. The list always starts at the top (no
          // `contentOffset` / `initialScrollIndex`), so 0 is the baseline; the
          // handler is a single ref flip and a no-op once the gate is open.
          // VirtualizedList already listens to scroll events for windowing and
          // merely forwards them here, so this adds no native listener. The
          // 64ms `scrollEventThrottle` below applies on BOTH platforms —
          // Android honours it too (ReactScrollViewHelper drops SCROLL events
          // inside the window; VirtualizedList's own default is per-frame) —
          // and because the list's windowing and viewability updates ride this
          // same forwarded stream, it slows those to ~15Hz as well. Accepted
          // trade-off: verse cells are tall and `windowSize={7}` keeps a deep
          // render buffer, and it keeps the JS-thread traffic light.
          onScroll={(e) => {
            if (hasScrolledRef.current) return;
            if (Math.abs(e.nativeEvent.contentOffset.y) > SCROLL_GATE_PX) hasScrolledRef.current = true;
          }}
          scrollEventThrottle={64}
          onMomentumScrollEnd={commitProgress}
          // Momentum alone misses a drag that stops without a fling.
          onScrollEndDrag={commitProgress}
          renderItem={({ item, index }) => (
            <VerseBlock
              verse={item}
              index={index + 1}
              lang={lang}
              colors={colors}
              t={tForLang}
              copyKey={`${positionKey ?? 'scripture'}-${index + 1}`}
              copyLabel={copyLabel}
            />
          )}
          ListHeaderComponent={
            <View>
              {/* ── Chapter heading ───────────────────────────────────── */}
              <View style={styles.heroBlock}>
                <Kicker color={colors.accentText} size={11} style={styles.heroKicker}>
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

              {/* ── Lang toggle (shared component) ────────────────────── */}
              <LangToggle lang={lang} onChange={setLang} colors={colors} />
            </View>
          }
          ListFooterComponent={
            <View>
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
            </View>
          }
        />
      </SafeAreaView>
    </ScreenMount>
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

