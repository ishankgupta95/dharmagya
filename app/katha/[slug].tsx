import { useMemo, type ReactNode } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
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
 * the numbered adhyays (each with its `sampurna` closing line). The katha
 * narrative prose is English-primary (see `@/config/kathas`), so unlike the
 * aarti/chalisa readers there is no language toggle — `KathaParagraphBlock`
 * renders whichever of `english` / `hindi` / `sanskrit` a paragraph carries.
 */
export default function KathaReaderScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';
  // Katha narrative prose is English-only, but the disclaimer is bilingual —
  // surface it in the app language so meta-text matches the chrome labels.
  const lang = i18n.language === 'hi' ? 'hi' : 'en';

  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const katha = useMemo(() => getKathaBySlug(slug), [slug]);

  if (!katha) {
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
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

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
          {katha.about.en.trim().length > 0 && (
            <SectionCard title={t('katha.aboutLabel')} colors={colors}>
              <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary }]}>
                {katha.about.en}
              </Text>
            </SectionCard>
          )}

          {/* ── Puja Samagri ─────────────────────────────────────────────── */}
          <SectionCard title={t('katha.samagriLabel')} colors={colors}>
            {katha.samagri.intro && (
              <KathaParagraphBlock para={katha.samagri.intro} colors={colors} first />
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
                <KathaParagraphBlock key={i} para={para} colors={colors} first={i === 0} />
              ))}
            </SectionCard>
          )}

          {/* ── The katha — numbered adhyays ─────────────────────────────── */}
          {katha.chapters.map((chapter) => (
            <ChapterCard key={chapter.number} chapter={chapter} colors={colors} t={t} />
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
 * Renders one `KathaParagraph`. A paragraph can be prose (English and/or
 * Hindi) or an embedded shloka (`sanskrit` + optional `iast`) — render
 * whichever fields are present. `first` drops the top margin so a paragraph
 * sits flush under a section kicker.
 */
function KathaParagraphBlock({
  para,
  colors,
  first,
}: {
  para: KathaParagraph;
  colors: ColorPalette;
  first?: boolean;
}) {
  return (
    <View style={first ? undefined : styles.paraSpaced}>
      {para.sanskrit && (
        <Text variant="deva-bold" style={[styles.shloka, { color: colors.textPrimary }]}>
          {para.sanskrit}
        </Text>
      )}
      {para.iast && (
        <Text variant="body-italic" style={[styles.shlokaIast, { color: colors.textTertiary }]}>
          {para.iast}
        </Text>
      )}
      {para.english && (
        <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary }]}>
          {para.english}
        </Text>
      )}
      {para.hindi && (
        <Text variant="deva" style={[styles.paragraphHindi, { color: colors.textSecondary }]}>
          {para.hindi}
        </Text>
      )}
    </View>
  );
}

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
  t,
}: {
  chapter: KathaChapter;
  colors: ColorPalette;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Kicker color={colors.accent} size={10}>
        {t('katha.adhyayKicker', { num: chapter.number })}
      </Kicker>
      <Text variant="body" style={[styles.chapterTitle, { color: colors.textPrimary }]}>
        {chapter.titleEnglish}
      </Text>
      {chapter.titleHindi && (
        <Text variant="deva" style={[styles.chapterTitleHi, { color: colors.textTertiary }]}>
          {chapter.titleHindi}
        </Text>
      )}
      <View style={styles.cardBody}>
        {chapter.paragraphs.map((para, i) => (
          <KathaParagraphBlock key={i} para={para} colors={colors} first={i === 0} />
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
  paragraphHindi: { fontSize: 15, lineHeight: 25, marginTop: 4 },
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
  chapterTitleHi: { fontSize: 14, lineHeight: 22, marginTop: 3 },
  sampurna: { fontSize: 12.5, lineHeight: 19, marginTop: 16, textAlign: 'center' },

  // Sources
  sourcesBlock: { marginTop: 4, gap: 8 },
  sourcesText: { fontSize: 12, lineHeight: 19 },

  // Empty / not-found
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
