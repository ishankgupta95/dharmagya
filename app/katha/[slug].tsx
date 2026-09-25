import { useMemo, type ReactNode } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { CopyableUnit, handleReaderTouchStart } from '@/components/reader/CopyableUnit';
import { buildCopyText } from '@/utils/verseCopy';

import { MotionPressable } from '@/components/common/MotionPressable';
import type { ContentLang } from '@/components/common/LangToggle';
import {
  getKathaBySlug,
  KATHA_DISCLAIMER,
  type KathaChapter,
  type KathaParagraph,
  type SamagriItem,
} from '@/config/kathas';

/**
 * Vrat Katha reader.
 *
 * Renders one katha as a narrative reader: title → puja samagri → puja vidhi →
 * the numbered adhyays (each with its `sampurna` closing line). Most of the
 * library's narrative paragraphs carry BOTH an `english` and a `hindi` face
 * (90 of 120 at v0.7.0), so every bilingual pair is resolved to a single face
 * in the app language through `pickFace` — rendering both would stack the whole
 * story twice. There is no in-screen toggle: the reader follows the app
 * language, the same way the `/katha` listing picks its row titles. Embedded
 * shloka lines (`sanskrit` / `iast`) are recited content, not a translation
 * pair, so they always render alongside the selected face.
 *
 * Every paragraph is a copy unit: long-press copies its Devanagari shloka (when
 * it has one) plus the paragraph in the reading language, and on Android arms
 * it for native text selection (see `CopyableUnit`).
 *
 * Kept as a ScrollView, a recorded exception to the "FlatList past ~50 rows"
 * rule the other readers follow. Satyanarayan is over it: 62 content rows at
 * hindu-devotional-texts 0.8.0 (35 chapter paragraphs, 25 samagri items, 1
 * vidhi paragraph and the samagri intro paragraph; 18–20k characters, 37 copy
 * units), where the other five kathas run 22–39. But the rows are not a flat
 * list: they are heterogeneous cards (About, Samagri, Vidhi, then one card
 * per adhyay with its title and `sampurna` line), and 8 cards as FlatList items
 * would all land in the first batch anyway. Virtualizing means slicing each
 * card into per-row list items that each draw a piece of the border, which
 * left 1px seams between cells on the API 36 emulator; not worth it for one
 * 62-row text. Revisit if a katha grows well past this.
 */
export default function KathaReaderScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';
  // One content language on screen at a time — this drives the narrative prose,
  // the chapter titles and the bilingual disclaimer. It deliberately does NOT
  // drive the samagri rows: see `SamagriRow`, whose `hindi` is a name gloss
  // rather than a second face of the same string.
  const lang: ContentLang = i18n.language === 'hi' ? 'hi' : 'en';

  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const katha = useMemo(() => getKathaBySlug(slug), [slug]);

  if (!katha) {
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
          <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {t('katha.indexTitle')}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>
        <View style={styles.emptyWrap}>
          <Text variant="body-italic" style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('katha.notFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Since hindu-devotional-texts 0.8.0 every katha ships an `about` summary
  // (they were empty in 0.7.0), so this card now renders on all six. Read it
  // in the app language rather than always in English; the guard below keeps
  // the card absent should a future release ship an empty string again.
  const aboutFace = pickFace(lang, katha.about.en.trim(), katha.about.hi.trim());
  const copyLabel = t('reader.copyAction');
  const copyPrefix = `katha-${katha.slug}`;

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
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

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}
          // Any touch outside a long-pressed paragraph ends its selection mode.
          onTouchStart={handleReaderTouchStart}>

          {/* ── Hero: katha title (app language) ─────────────────────────── */}
          <View style={styles.hero}>
            <Text
              variant={lang === 'hi' ? 'deva-bold' : 'display-italic'}
              style={[styles.heroTitle, { color: colors.textPrimary }]}>
              {lang === 'hi' ? katha.titleHindi : katha.titleEnglish}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.heroOrnament} />
          </View>

          {/* ── About — rendered only when the library carries a summary ─── */}
          {aboutFace && (
            <SectionCard title={t('katha.aboutLabel')} colors={colors}>
              <Text
                variant={aboutFace.isHindi ? 'deva' : 'body'}
                style={[
                  aboutFace.isHindi ? styles.paragraphHindi : styles.paragraph,
                  { color: colors.textSecondary },
                ]}>
                {aboutFace.text}
              </Text>
            </SectionCard>
          )}

          {/* ── Puja Samagri ─────────────────────────────────────────────── */}
          <SectionCard title={t('katha.samagriLabel')} colors={colors}>
            {katha.samagri.intro && (
              <KathaParagraphBlock
                para={katha.samagri.intro}
                colors={colors}
                lang={lang}
                first
                copyKey={`${copyPrefix}-samagri`}
                copyLabel={copyLabel}
              />
            )}
            <View style={katha.samagri.intro ? styles.samagriListSpaced : undefined}>
              {katha.samagri.items.map((item, i) => (
                <SamagriRow key={i} item={item} colors={colors} />
              ))}
            </View>
          </SectionCard>

          {/* ── Puja Vidhi ───────────────────────────────────────────────── */}
          {katha.vidhi.length > 0 && (
            <SectionCard title={t('katha.vidhiLabel')} colors={colors}>
              {katha.vidhi.map((para, i) => (
                <KathaParagraphBlock
                  key={i}
                  para={para}
                  colors={colors}
                  lang={lang}
                  first={i === 0}
                  copyKey={`${copyPrefix}-vidhi-${i}`}
                  copyLabel={copyLabel}
                />
              ))}
            </SectionCard>
          )}

          {/* ── The katha — numbered adhyays ─────────────────────────────── */}
          {katha.chapters.map((chapter) => (
            <ChapterCard
              key={chapter.number}
              chapter={chapter}
              colors={colors}
              lang={lang}
              t={t}
              copyPrefix={copyPrefix}
              copyLabel={copyLabel}
            />
          ))}

          {/* ── Sources / disclaimer ─────────────────────────────────────── */}
          <View style={styles.sourcesBlock}>
            <Kicker color={colors.textMuted} size={9}>{t('katha.sourcesLabel')}</Kicker>
            <Text variant="body-italic" style={[styles.sourcesText, { color: colors.textMuted }]}>
              {KATHA_DISCLAIMER[lang]}
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Language selection ───────────────────────────────────────────────────────

/**
 * Resolve a bilingual pair down to the single face this reader shows, falling
 * back to the other one when the library ships only half the pair. Mirrors the
 * `VerseBlock` convention used by every other bilingual reader in the app: one
 * language on screen at a time, never both stacked. Returns `null` when neither
 * face carries text. `isHindi` tells the caller which font variant to use.
 */
function pickFace(
  lang: ContentLang,
  english: string | undefined,
  hindi: string | undefined,
): { text: string; isHindi: boolean } | null {
  const preferred = lang === 'hi' ? hindi : english;
  if (preferred) return { text: preferred, isHindi: lang === 'hi' };
  const fallback = lang === 'hi' ? english : hindi;
  if (fallback) return { text: fallback, isHindi: lang !== 'hi' };
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, colors, children }: { title: string; colors: ColorPalette; children: ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Kicker color={colors.accent} size={10}>{title}</Kicker>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

/**
 * Renders one `KathaParagraph`. The `english` / `hindi` faces are a translation
 * pair, so only the one matching the app language is shown (see `pickFace`) —
 * the library carries both on most paragraphs, and stacking them would print
 * the whole narrative twice. An embedded shloka (`sanskrit` + optional `iast`)
 * is recited content rather than a translation, so it renders above whichever
 * prose face was picked. `first` drops the top margin so a paragraph sits flush
 * under a section kicker.
 *
 * Long-press copies the shloka's Devanagari (when present) plus the prose face
 * being read; a shloka-only paragraph with no Devanagari copies its IAST. The
 * screen-reader copy action sits on the prose (or, without prose, the shloka).
 */
function KathaParagraphBlock({
  para,
  colors,
  lang,
  first,
  copyKey,
  copyLabel,
}: {
  para: KathaParagraph;
  colors: ColorPalette;
  lang: ContentLang;
  first?: boolean;
  copyKey: string;
  copyLabel: string;
}) {
  const prose = pickFace(lang, para.english, para.hindi);
  const hasShloka = para.sanskrit !== undefined || para.iast !== undefined;
  const copyParts = para.sanskrit || prose ? [para.sanskrit, prose?.text] : [para.iast];
  return (
    <CopyableUnit
      copyKey={copyKey}
      copyLabel={copyLabel}
      getCopyText={() => buildCopyText(copyParts)}
      style={first ? undefined : styles.paraSpaced}>
      {({ selectable, a11y }) => (
        <>
          {para.sanskrit && (
            <Text
              {...(prose ? undefined : a11y)}
              selectable={selectable}
              variant="deva-bold"
              style={[styles.shloka, { color: colors.textPrimary }]}>
              {para.sanskrit}
            </Text>
          )}
          {para.iast && (
            <Text
              {...(prose || para.sanskrit ? undefined : a11y)}
              selectable={selectable}
              variant="body-italic"
              style={[styles.shlokaIast, { color: colors.textTertiary }]}>
              {para.iast}
            </Text>
          )}
          {prose && (
            <Text
              {...a11y}
              selectable={selectable}
              variant={prose.isHindi ? 'deva' : 'body'}
              style={[
                prose.isHindi ? styles.paragraphHindi : styles.paragraph,
                hasShloka && styles.proseAfterShloka,
                { color: colors.textSecondary },
              ]}>
              {prose.text}
            </Text>
          )}
        </>
      )}
    </CopyableUnit>
  );
}

/**
 * Renders one `SamagriItem`. Unlike `KathaParagraph`, this is NOT a translation
 * pair: `english` is required and carries the whole row, while `hindi` is an
 * optional short Devanagari NAME GLOSS for the headline ingredient. The data
 * proves it — "Flowers, akshat (unbroken rice), and chandan (sandalwood paste)"
 * glosses to `अक्षत` alone, and "A sieve (channi), for sighting the moon and the
 * husband through it" to `छलनी` alone. So the gloss is always APPENDED and never
 * substituted: swapping it in for Hindi readers would silently delete real
 * shopping-list items and ritual instructions. Both faces therefore render in
 * both app languages, in a single `body` run — the Devanagari picks up the
 * system fallback face — and the row does not take `lang` at all. Most of the
 * 86 items ship no `hindi`; that is an upstream gap, not something to paper
 * over here.
 */
function SamagriRow({ item, colors }: { item: SamagriItem; colors: ColorPalette }) {
  const label = item.hindi ? `${item.english} (${item.hindi})` : item.english;
  return (
    <View style={styles.samagriRow}>
      <View style={[styles.samagriDot, { backgroundColor: colors.accent }]} />
      <Text variant="body" style={[styles.samagriText, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

function ChapterCard({
  chapter,
  colors,
  lang,
  t,
  copyPrefix,
  copyLabel,
}: {
  chapter: KathaChapter;
  colors: ColorPalette;
  lang: ContentLang;
  t: (key: string, opts?: Record<string, unknown>) => string;
  copyPrefix: string;
  copyLabel: string;
}) {
  // Every chapter ships both title faces — show only the one being read.
  const title = pickFace(lang, chapter.titleEnglish, chapter.titleHindi);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Kicker color={colors.accent} size={10}>
        {t('katha.adhyayKicker', { num: chapter.number })}
      </Kicker>
      {title && (
        <Text
          variant={title.isHindi ? 'deva' : 'body'}
          style={[
            title.isHindi ? styles.chapterTitleHi : styles.chapterTitle,
            { color: colors.textPrimary },
          ]}>
          {title.text}
        </Text>
      )}
      <View style={styles.cardBody}>
        {chapter.paragraphs.map((para, i) => (
          <KathaParagraphBlock
            key={i}
            para={para}
            colors={colors}
            lang={lang}
            first={i === 0}
            copyKey={`${copyPrefix}-ch${chapter.number}-${i}`}
            copyLabel={copyLabel}
          />
        ))}
      </View>
      <Text variant="body-italic" style={[styles.sampurna, { color: colors.textMuted }]}>
        {chapter.sampurna}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  headerTitle: { flex: 1, fontSize: 20, lineHeight: 26, textAlign: 'center' },

  scroll: { paddingTop: 16, paddingBottom: 24 },

  // Hero
  hero: { alignItems: 'center', marginBottom: 20, paddingTop: 4 },
  heroTitle: { fontSize: 25, lineHeight: 34, textAlign: 'center' },
  heroOrnament: { marginTop: 14, width: '55%' },

  // Cards
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
    marginBottom: spacing.cardGap,
  },
  cardBody: { marginTop: 12 },

  paragraph: { fontSize: 14, lineHeight: 22 },
  // No top margin: only one prose face renders per paragraph now, so it leads
  // the block exactly like `paragraph` does. `proseAfterShloka` re-adds the gap
  // for the handful of paragraphs that open with an embedded shloka.
  paragraphHindi: { fontSize: 15, lineHeight: 25 },
  proseAfterShloka: { marginTop: 10 },
  paraSpaced: { marginTop: 14 },

  // Embedded shloka
  shloka: { fontSize: 17, lineHeight: 27, textAlign: 'center' },
  shlokaIast: { fontSize: 12.5, lineHeight: 18, marginTop: 4, textAlign: 'center' },

  // Samagri
  samagriListSpaced: { marginTop: 14 },
  samagriRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  samagriDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 9 },
  samagriText: { flex: 1, fontSize: 13.5, lineHeight: 20 },

  // Chapter
  chapterTitle: { fontSize: 15.5, lineHeight: 22, marginTop: 8 },
  // The Devanagari title is now the title itself rather than a second line
  // under the English one, so it takes the same leading margin.
  chapterTitleHi: { fontSize: 15, lineHeight: 24, marginTop: 8 },
  sampurna: { fontSize: 12.5, lineHeight: 19, marginTop: 16, textAlign: 'center' },

  // Sources
  sourcesBlock: { marginTop: 4, gap: 8 },
  sourcesText: { fontSize: 12, lineHeight: 19 },

  // Empty / not-found
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
