import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  View,
  TextInput,
  SectionList,
  StyleSheet,
  type SectionListData,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Icon, type IconName } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { ScreenMount } from '@/components/common/ScreenMount';
import {
  getAllAppAartis,
  getAllAppChalisas,
  getAllAppStotras,
  getAllAppSuktas,
  getAllAppSahasranamas,
} from '@/services/content';
import { ALL_KATHAS } from '@/config/kathas';
import { ALL_SCRIPTURES } from '@/config/scriptures';
import { ALL_DEITIES } from '@/config/deities';
import { getAllTirthas } from '@/config/tirtha';

type TextKind = 'aarti' | 'chalisa' | 'stotra' | 'sukta' | 'sahasranama' | 'katha' | 'scripture';

// One search result. Three kinds of answer to the same word (frame 17):
// a text, a deity, and a tirtha stay in their own groups.
type SearchResult =
  | {
      kind: 'text';
      key: string;
      textKind: TextKind;
      titleEnglish: string;
      titleHindi: string;
      deity?: string;
      href: Href;
    }
  | {
      kind: 'deity';
      key: string;
      deity: string;
      titleEnglish: string;
      titleHindi: string;
      textCount: number;
      href: Href;
    }
  | {
      kind: 'tirtha';
      key: string;
      titleEnglish: string;
      titleHindi: string;
      locationEnglish: string;
      locationHindi: string;
      href: Href;
    };

interface ResultSection extends SectionListData<SearchResult> {
  kind: 'text' | 'deity' | 'tirtha';
  title: string;
}

const TIRTHA_ICON: IconName = 'compass';

export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const selectedDeities = useStore(s => s.selectedDeities);
  const colors = isDarkMode ? darkColors : lightColors;
  const inputRef = useRef<TextInput>(null);
  const isHi = i18n.language === 'hi';

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // The settled query drives everything below the search bar — results,
  // highlighting and the prompt / no-results choice — so they only move
  // together once the debounce lands, never per keystroke. Clearing the
  // field resets at once rather than waiting out the debounce. The live
  // `query` still drives the input chrome (border, icon, clear button).
  const activeQuery = query.trim().length > 0 ? debouncedQuery : '';

  // An empty field also drops the settled query right away. Otherwise a
  // keystroke within 300 ms of clearing would cancel the pending reset and
  // bring back the old query's results under the new text until the
  // debounce lands.
  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (text.trim().length === 0) setDebouncedQuery('');
  };

  // All searchable items. Texts across the eight collections, the deity
  // roster, and the tirtha atlas — rebuilt when the language changes so
  // localized names join the filter target.
  const corpus = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [];

    for (const a of getAllAppAartis()) {
      items.push({ kind: 'text', key: `aarti-${a.deity}`, textKind: 'aarti', titleEnglish: a.titleEnglish, titleHindi: a.titleHindi, deity: a.deity, href: { pathname: '/aarti/[id]', params: { id: a.deity } } });
    }
    for (const c of getAllAppChalisas()) {
      items.push({ kind: 'text', key: `chalisa-${c.deity}`, textKind: 'chalisa', titleEnglish: c.titleEnglish, titleHindi: c.titleHindi, deity: c.deity, href: { pathname: '/chalisa/[id]', params: { id: c.deity } } });
    }
    for (const s of getAllAppStotras()) {
      items.push({ kind: 'text', key: `stotra-${s.slug}`, textKind: 'stotra', titleEnglish: s.titleEnglish, titleHindi: s.titleHindi, deity: s.deity, href: { pathname: '/stotra/[slug]', params: { slug: s.slug } } });
    }
    for (const s of getAllAppSuktas()) {
      items.push({ kind: 'text', key: `sukta-${s.slug}`, textKind: 'sukta', titleEnglish: s.titleEnglish, titleHindi: s.titleHindi, deity: s.deity, href: { pathname: '/sukta/[slug]', params: { slug: s.slug } } });
    }
    for (const s of getAllAppSahasranamas()) {
      items.push({ kind: 'text', key: `sahasranama-${s.slug}`, textKind: 'sahasranama', titleEnglish: s.titleEnglish, titleHindi: s.titleHindi, deity: s.deity, href: { pathname: '/sahasranama/[slug]', params: { slug: s.slug } } });
    }
    for (const k of ALL_KATHAS) {
      items.push({ kind: 'text', key: `katha-${k.slug}`, textKind: 'katha', titleEnglish: k.titleEnglish, titleHindi: k.titleHindi, href: { pathname: '/katha/[slug]', params: { slug: k.slug } } });
    }
    for (const s of ALL_SCRIPTURES) {
      items.push({ kind: 'text', key: `scripture-${s.slug}`, textKind: 'scripture', titleEnglish: s.titleEnglish, titleHindi: s.titleHindi, href: { pathname: '/scripture/[id]', params: { id: s.slug } } });
    }

    const textCountByDeity = new Map<string, number>();
    for (const item of items) {
      if (item.kind === 'text' && item.deity) {
        textCountByDeity.set(item.deity, (textCountByDeity.get(item.deity) ?? 0) + 1);
      }
    }
    for (const d of ALL_DEITIES) {
      items.push({
        kind: 'deity',
        key: `deity-${d.id}`,
        deity: d.id,
        titleEnglish: t(`deities.${d.id}.displayName`, { lng: 'en' }),
        titleHindi: t(`deities.${d.id}.displayName`, { lng: 'hi' }),
        textCount: textCountByDeity.get(d.id) ?? 0,
        href: { pathname: '/god/[id]', params: { id: d.id } },
      });
    }

    for (const site of getAllTirthas()) {
      items.push({
        kind: 'tirtha',
        key: `tirtha-${site.id}`,
        titleEnglish: site.name.en,
        titleHindi: site.name.hi,
        locationEnglish: site.location.en,
        locationHindi: site.location.hi,
        href: { pathname: '/tirtha/[id]', params: { id: site.id } },
      });
    }

    return items;
  }, [t]);

  const results = useMemo<SearchResult[]>(() => {
    if (!activeQuery) return [];
    const q = activeQuery.toLowerCase();
    const qRaw = activeQuery;
    const matched = corpus.filter(item => {
      if (item.titleEnglish.toLowerCase().includes(q) || item.titleHindi.includes(qRaw)) return true;
      if (item.kind === 'text' || item.kind === 'deity') {
        const deity = item.kind === 'text' ? item.deity : item.deity;
        if (deity && (deity.toLowerCase().includes(q) || t(`deities.${deity}.displayName`).toLowerCase().includes(q) || t(`deities.${deity}.displayName`).includes(qRaw))) {
          return true;
        }
      }
      if (item.kind === 'tirtha') {
        return item.locationEnglish.toLowerCase().includes(q) || item.locationHindi.includes(qRaw);
      }
      return false;
    });
    // The user's chosen deities float their items up within each group.
    if (selectedDeities.length > 0) {
      const prefer = new Set(selectedDeities);
      const isPreferred = (r: SearchResult) =>
        r.kind !== 'tirtha' && r.deity != null && prefer.has(r.deity);
      matched.sort((a, b) => (isPreferred(a) ? 0 : 1) - (isPreferred(b) ? 0 : 1));
    }
    return matched;
  }, [corpus, activeQuery, selectedDeities, t]);

  const sections: ResultSection[] = useMemo(() => {
    const texts = results.filter(r => r.kind === 'text');
    const deities = results.filter(r => r.kind === 'deity');
    const tirthas = results.filter(r => r.kind === 'tirtha');
    const out: ResultSection[] = [];
    if (texts.length > 0) out.push({ kind: 'text', title: t('search.textsSection', { count: texts.length }), data: texts });
    if (deities.length > 0) out.push({ kind: 'deity', title: t('search.deitiesSection', { count: deities.length }), data: deities });
    if (tirthas.length > 0) out.push({ kind: 'tirtha', title: t('search.tirthaSection', { count: tirthas.length }), data: tirthas });
    return out;
  }, [results, t]);

  const hasQuery = query.trim().length > 0;
  const hasResults = results.length > 0;

  // Keyed on the settled query, not the live one, so typing does not hand
  // the SectionList a new renderItem (and re-render every mounted row) on
  // each keystroke while the result set is unchanged.
  const renderItem = useCallback(({ item, index, section }: { item: SearchResult; index: number; section: SectionListData<SearchResult> }) => (
    <ResultRow
      item={item}
      query={activeQuery}
      colors={colors}
      isHi={isHi}
      first={index === 0}
      last={index === section.data.length - 1}
    />
  ), [activeQuery, colors, isHi]);

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      {/* ── Search bar · Cancel ──────────────────────────────────────── */}
      <View style={[styles.searchBar, { paddingHorizontal: spacing.screenH }]}>
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: colors.surface,
              borderColor: hasQuery ? colors.borderAccent : colors.border,
            },
          ]}>
          <Icon name="search" size={16} color={hasQuery ? colors.accent : colors.textMuted} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={handleQueryChange}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.textPrimary, fontFamily: 'Geist_400Regular' }]}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {hasQuery && (
            <MotionPressable
              onPress={() => handleQueryChange('')}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.clearSearch')}>
              <Icon name="close-circle" size={16} color={colors.textMuted} />
            </MotionPressable>
          )}
        </View>
        <MotionPressable
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}>
          <Text variant="body" style={[styles.cancelText, { color: colors.accentText }]}>
            {t('common.cancel')}
          </Text>
        </MotionPressable>
      </View>

      {/* ── Results / States ─────────────────────────────────────────── */}
      {!activeQuery ? (
        <EmptyPrompt colors={colors} />
      ) : !hasResults ? (
        <NoResults query={activeQuery} colors={colors} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.base }]}>
              <Text variant="kicker-small" style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
                {section.title}
              </Text>
            </View>
          )}
          contentContainerStyle={[styles.results, { paddingHorizontal: spacing.screenH }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          stickySectionHeadersEnabled={false}
          ListFooterComponent={
            <View style={styles.adWrap}>
              <AdBanner colors={colors} placement="searchInline" inline />
            </View>
          }
        />
      )}

    </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Result row — one grouped card per section ────────────────────────────────

interface ResultRowProps {
  item: SearchResult;
  query: string;
  colors: ColorPalette;
  isHi: boolean;
  first: boolean;
  last: boolean;
}

// Navigates itself (router is a module import) instead of taking an onPress
// closure from renderItem, so the memo holds across parent re-renders.
const ResultRow = memo(function ResultRow({ item, query, colors, isHi, first, last }: ResultRowProps) {
  const { t } = useTranslation();
  const onPress = () => router.push(item.href);

  const title = isHi ? item.titleHindi : item.titleEnglish;
  let caption: string;
  switch (item.kind) {
    case 'text':
      caption = t(`search.kind.${item.textKind}`);
      break;
    case 'deity':
      caption = t('search.deityTexts', { count: item.textCount });
      break;
    case 'tirtha':
      caption = isHi ? item.locationHindi : item.locationEnglish;
      break;
  }

  return (
    <View
      style={[
        styles.rowShell,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        first && styles.rowShellFirst,
        last && styles.rowShellLast,
      ]}>
      {!first && <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />}
      <MotionPressable
        pressedScale={0.98}
        onPress={onPress}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={`${item.titleEnglish} — ${caption}`}>
        {item.kind !== 'tirtha' && item.deity ? (
          <DeityAvatar deity={item.deity} size={36} />
        ) : (
          <View style={styles.rowIconWrap}>
            <Icon name={item.kind === 'tirtha' ? TIRTHA_ICON : 'text'} size={19} color={colors.textTertiary} />
          </View>
        )}
        <View style={styles.rowText}>
          <HighlightText
            text={title}
            query={query}
            variant={isHi ? 'deva' : 'body'}
            baseStyle={[styles.rowTitle, { color: colors.textPrimary }]}
            highlightColor={colors.accent}
          />
          <Text variant="body-small" style={[styles.rowCaption, { color: colors.textMuted }]} numberOfLines={1}>
            {caption}
          </Text>
        </View>
        <Icon name="chevron-right" size={14} color={colors.textDisabled} />
      </MotionPressable>
    </View>
  );
});

// ─── Highlight Text ───────────────────────────────────────────────────────────

interface HighlightTextProps {
  text: string;
  query: string;
  variant: 'deva' | 'body';
  baseStyle: object | object[];
  highlightColor: string;
}

const HighlightText = memo(function HighlightText({ text, query, variant, baseStyle, highlightColor }: HighlightTextProps) {
  const q = query.trim();
  if (!q) return <Text variant={variant} style={baseStyle}>{text}</Text>;

  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1) return <Text variant={variant} style={baseStyle}>{text}</Text>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);

  return (
    <Text variant={variant} style={baseStyle}>
      {before}
      <Text variant={variant} style={{ color: highlightColor }}>{match}</Text>
      {after}
    </Text>
  );
});

// ─── Empty States ─────────────────────────────────────────────────────────────

function EmptyPrompt({ colors }: { colors: ColorPalette }) {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <Icon name="search" size={30} color={colors.textDisabled} />
      <Text variant="title" style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        {t('search.emptyTitle')}
      </Text>
      <Text variant="body" style={[styles.emptySub, { color: colors.textTertiary }]}>
        {t('search.emptyDesc')}
      </Text>
    </View>
  );
}

function NoResults({ query, colors }: { query: string; colors: ColorPalette }) {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <Icon name="info-circle" size={30} color={colors.textDisabled} />
      <Text variant="title" style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        {t('search.noResults')}
      </Text>
      <Text variant="body" style={[styles.emptySub, { color: colors.textTertiary }]}>
        {t('search.noResultsFor', { query })}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 14,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    padding: 0,
    margin: 0,
  },
  cancelText: { fontSize: 15 },

  // Results
  results: { paddingTop: 2, paddingBottom: 32 },

  // Section header
  sectionHeaderWrap: { paddingTop: 16, paddingBottom: 9 },
  sectionHeaderText: { fontSize: 9.5, paddingHorizontal: 4 },

  // Grouped-card rows: side borders always, top/bottom borders + radius only
  // on the section's first/last row, so each section reads as one card.
  rowShell: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  rowShellFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: borderRadius.list,
    borderTopRightRadius: borderRadius.list,
  },
  rowShellLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: borderRadius.list,
    borderBottomRightRadius: borderRadius.list,
  },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 47 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 17,
  },
  rowIconWrap: { width: 36, alignItems: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, lineHeight: 22 },
  rowCaption: { fontSize: 12, marginTop: 1 },

  // Empty states
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, marginTop: 4 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  adWrap: { marginTop: 14 },
});
