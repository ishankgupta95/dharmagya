import { useMemo, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, spacing, type ColorPalette } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { AdBanner } from '@/components/common/AdBanner';
import { MotionPressable } from '@/components/common/MotionPressable';
import { FavoriteHeart } from '@/components/common/FavoriteHeart';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import { VerseBlock } from '@/components/reader/VerseBlock';
import { CopyableUnit, handleReaderTouchStart } from '@/components/reader/CopyableUnit';
import { buildCopyText } from '@/utils/verseCopy';
import { SCRIPTURE_DISCLAIMER } from '@/config/scriptures';
import i18n, { resolveLanguage } from '@/i18n';
import {
  getSahasranamaBySlug,
  titleFor,
  type ContentLang,
  type NamavaliName,
  type Sahasranama,
  type SahasranamaSection,
} from '@/services/content';

type Mode = 'stotram' | 'namavali';

type StotramVerse = SahasranamaSection['verses'][number];

/**
 * One flattened stotram row. The stotram is nested (section → verses), but a
 * FlatList needs a flat `data` array — so section titles become rows of their
 * own rather than a `renderSectionHeader`, which keeps both modes on the exact
 * same list shape and props.
 */
type StotramRow =
  | { kind: 'sectionTitle'; key: string; title: string }
  | { kind: 'verse'; key: string; verse: StotramVerse; index: number };

/**
 * Sahasranama reader (Vishnu / Lalita — 1000 names). A segmented toggle swaps
 * between the **Stotram** (the sectioned verse recitation — purva / dhyana /
 * stotram / phalashruti, rendered with the shared `VerseBlock`) and the
 * **1000 Names** namavali (the `app/ashtottara` NameRow treatment). Both modes
 * are virtualised in a FlatList — the stotram is the landing tab and is the
 * heavier of the two per node (lalita is 4 sections / 348 verses), so it is
 * flattened into `sectionTitle` / `verse` rows rather than mapped inline.
 * Meaning language follows the in-screen toggle; the provisional-review note
 * shows when `reviewPending`.
 */
export default function SahasranamaReaderScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const appLanguage = useStore((s) => s.language);
  const favoriteIds = useStore((s) => s.favoriteIds);
  const toggleFavorite = useStore((s) => s.toggleFavorite);

  const lang: ContentLang = useMemo(() => resolveLanguage(appLanguage), [appLanguage]);
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);
  const [mode, setMode] = useState<Mode>('stotram');

  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const sahasranama = useMemo(() => (slug ? getSahasranamaBySlug(slug) : undefined), [slug]);

  // Flattened once per text/language rather than on every render: the section
  // titles are language-dependent, the verses are not.
  const stotramRows = useMemo<StotramRow[]>(() => {
    if (!sahasranama) return [];
    const rows: StotramRow[] = [];
    for (const section of sahasranama.stotram) {
      const title = lang === 'hi'
        ? (section.titleHindi ?? section.titleSanskrit ?? section.titleEnglish)
        : (section.titleEnglish ?? section.titleSanskrit);
      if (title) rows.push({ kind: 'sectionTitle', key: `${section.key}-title`, title });
      section.verses.forEach((verse, i) => {
        rows.push({ kind: 'verse', key: `${section.key}-${i}`, verse, index: i + 1 });
      });
    }
    return rows;
  }, [sahasranama, lang]);

  if (!sahasranama) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
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
        <View style={styles.emptyWrap}>
          <Text variant="body-italic" style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('sahasranama.notFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const favKey = `sahasranama-${sahasranama.slug}`;
  const isFavorite = favoriteIds.includes(favKey);
  // Screen-reader chrome, so the app language (`t`), as for the back button.
  const copyLabel = t('reader.copyAction');

  const Header = (
    <ReaderHead
      sahasranama={sahasranama}
      lang={lang}
      tForLang={tForLang}
      colors={colors}
      isDarkMode={isDarkMode}
      mode={mode}
      onMode={setMode}
    />
  );

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        <View style={[styles.navRow, { borderBottomColor: colors.divider }]}>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
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

        {/* `key={mode}` is load-bearing now that both branches are FlatLists:
            without it React sees the same element type either side of the
            ternary and updates in place, so the scroll offset (and the cell
            cache) carries over into the other mode. The toggle lives in the
            list header, so the old ScrollView→FlatList swap always reset to
            the top — keep that. */}
        {mode === 'namavali' ? (
          <FlatList
            key="namavali"
            data={sahasranama.namavali}
            keyExtractor={(item) => String(item.number)}
            contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={24}
            windowSize={11}
            onTouchStart={handleReaderTouchStart}
            renderItem={({ item }) => (
              <NameRow
                name={item}
                lang={lang}
                colors={colors}
                copyKey={`${favKey}-name-${item.number}`}
                copyLabel={copyLabel}
              />
            )}
            ListHeaderComponent={Header}
            ListFooterComponent={<Footer reviewPending={sahasranama.reviewPending} lang={lang} tForLang={tForLang} colors={colors} />}
          />
        ) : (
          <FlatList
            key="stotram"
            data={stotramRows}
            keyExtractor={(item) => item.key}
            contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={24}
            windowSize={11}
            onTouchStart={handleReaderTouchStart}
            renderItem={({ item }) =>
              item.kind === 'sectionTitle' ? (
                <Kicker
                  color={colors.accentText}
                  size={10}
                  withTrailingRule
                  ruleColor={colors.divider}
                  wrapperStyle={styles.sectionKicker}
                  style={styles.sectionKickerText}>
                  {item.title}
                </Kicker>
              ) : (
                <VerseBlock
                  verse={item.verse}
                  index={item.index}
                  lang={lang}
                  colors={colors}
                  t={tForLang}
                  copyKey={`${favKey}-${item.key}`}
                  copyLabel={copyLabel}
                />
              )
            }
            ListHeaderComponent={Header}
            ListFooterComponent={<Footer reviewPending={sahasranama.reviewPending} lang={lang} tForLang={tForLang} colors={colors} />}
          />
        )}
      </SafeAreaView>
    </ScreenMount>
  );
}

function ReaderHead({
  sahasranama, lang, tForLang, colors, isDarkMode, mode, onMode,
}: {
  sahasranama: Sahasranama;
  lang: ContentLang;
  tForLang: (key: string, opts?: Record<string, unknown>) => string;
  colors: ColorPalette;
  isDarkMode: boolean;
  mode: Mode;
  onMode: (m: Mode) => void;
}) {
  const about = sahasranama.about[lang]?.trim();
  return (
    <View>
      <View style={styles.heroBlock}>
        <Text
          variant={lang === 'hi' ? 'deva-bold' : 'display-italic'}
          style={[styles.heroTitle, { color: colors.textPrimary }]}>
          {titleFor(sahasranama, lang)}
        </Text>
        <Text variant="mono-caps" style={[styles.heroSubtitle, { color: colors.textMuted }]}>
          {tForLang('sahasranama.nameCount', { count: sahasranama.namavali.length })}
        </Text>
        <Ornament variant="lotus" tone={isDarkMode ? 'dark' : 'light'} style={styles.heroOrnament} />
      </View>

      <View style={styles.modeToggle}>
        <ModeChip label={tForLang('sahasranama.tabStotram')} active={mode === 'stotram'} onPress={() => onMode('stotram')} colors={colors} />
        <ModeChip label={tForLang('sahasranama.tabNamavali')} active={mode === 'namavali'} onPress={() => onMode('namavali')} colors={colors} />
      </View>

      {!!about && (
        <Text variant={lang === 'hi' ? 'deva' : 'body'} style={[styles.about, { color: colors.textSecondary }]}>
          {about}
        </Text>
      )}
    </View>
  );
}

function ModeChip({ label, active, onPress, colors }: { label: string; active: boolean; onPress: () => void; colors: ColorPalette }) {
  return (
    <SegmentedChip
      active={active}
      onPress={onPress}
      inactiveBg="transparent"
      activeBg={colors.accent}
      style={styles.modeChip}
      accessibilityLabel={label}>
      <Text
        variant="mono-caps"
        style={[styles.modeChipText, { color: active ? colors.base : colors.textSecondary }]}>
        {label}
      </Text>
    </SegmentedChip>
  );
}

/** One namavali name. Long-press copies the Devanagari name (plus its meaning
 *  in the reader language, should the library ever ship one — none do at
 *  0.8.0) and arms the row for native text selection. */
function NameRow({
  name, lang, colors, copyKey, copyLabel,
}: {
  name: NamavaliName;
  lang: ContentLang;
  colors: ColorPalette;
  copyKey: string;
  copyLabel: string;
}) {
  return (
    <CopyableUnit
      copyKey={copyKey}
      copyLabel={copyLabel}
      getCopyText={() => buildCopyText([name.archana, name.meaning?.[lang]])}
      style={styles.nameRow}>
      {({ selectable, a11y }) => (
        <>
          <Text variant="mono" style={[styles.nameNumber, { color: colors.textMuted }]}>
            {name.number}
          </Text>
          <View style={styles.nameText}>
            <Text
              {...a11y}
              selectable={selectable}
              variant="deva"
              style={[styles.nameDeva, { color: colors.textPrimary }]}>
              {name.archana}
            </Text>
            {!!name.iast && (
              <Text
                selectable={selectable}
                variant="body-italic"
                style={[styles.nameIast, { color: colors.textTertiary }]}>
                {name.iast}
              </Text>
            )}
          </View>
        </>
      )}
    </CopyableUnit>
  );
}

function Footer({
  reviewPending, lang, tForLang, colors,
}: {
  reviewPending?: boolean;
  lang: ContentLang;
  tForLang: (key: string) => string;
  colors: ColorPalette;
}) {
  return (
    <View style={styles.footer}>
      {reviewPending && (
        <Text variant="body-italic" style={[styles.reviewNote, { color: colors.textSecondary }]}>
          {tForLang('reader.reviewNote')}
        </Text>
      )}
      <Kicker color={colors.textMuted} size={9}>{tForLang('scripture.sourcesLabel')}</Kicker>
      <Text variant="body-italic" style={[styles.sourcesText, { color: colors.textMuted }]}>
        {SCRIPTURE_DISCLAIMER[lang]}
      </Text>
      <View style={styles.adWrap}>
        <AdBanner colors={colors} placement="godDetailInline" inline />
      </View>
      <View style={{ height: 32 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screenH, paddingTop: 6, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navPill: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 16, paddingBottom: 24 },
  heroBlock: { alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  heroTitle: { fontSize: 26, lineHeight: 34, textAlign: 'center' },
  heroSubtitle: { fontSize: 9, letterSpacing: 1.6, marginTop: 12, textAlign: 'center' },
  heroOrnament: { marginTop: 14, width: '50%' },
  modeToggle: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeChip: {
    flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
    borderColor: 'transparent', alignItems: 'center', justifyContent: 'center',
  },
  modeChipText: { fontSize: 9.5, letterSpacing: 1.6 },
  about: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 16, paddingHorizontal: 4 },
  sectionKicker: { marginTop: 16, marginBottom: 4 },
  sectionKickerText: { letterSpacing: 2.4 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 16 },
  nameNumber: { fontSize: 12, minWidth: 36, textAlign: 'right' },
  nameText: { flex: 1 },
  nameDeva: { fontSize: 18, lineHeight: 28 },
  nameIast: { fontSize: 13, lineHeight: 19, marginTop: 1 },
  footer: { marginTop: 12, gap: 8 },
  reviewNote: { fontSize: 12, lineHeight: 18 },
  sourcesText: { fontSize: 12, lineHeight: 19 },
  adWrap: { marginTop: 12 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
