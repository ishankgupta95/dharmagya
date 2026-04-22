import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import {
  View,
  TextInput,
  SectionList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { DEITY_BY_ID } from '@/config/deities';
import { getAllAppAartis, getAllAppChalisas } from '@/services/content';

interface SearchResult {
  type: 'aarti' | 'chalisa';
  /** Deity slug — also doubles as the route param. */
  deity: string;
  titleEnglish: string;
  titleHindi: string;
  /** Localized display name for the deity badge (resolved via i18n). */
  deityLabel: string;
}

interface ResultSection {
  type: 'aarti' | 'chalisa';
  title: string;
  data: SearchResult[];
}

export default function SearchScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const selectedDeities = useStore(s => s.selectedDeities);
  const colors = isDarkMode ? darkColors : lightColors;
  const inputRef = useRef<TextInput>(null);

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

  // All searchable items, computed once.
  const corpus = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [];
    for (const a of getAllAppAartis()) {
      const meta = DEITY_BY_ID[a.deity];
      items.push({
        type: 'aarti',
        deity: a.deity,
        titleEnglish: a.titleEnglish,
        titleHindi: a.titleHindi,
        deityLabel: meta?.name ?? a.deity,
      });
    }
    for (const c of getAllAppChalisas()) {
      const meta = DEITY_BY_ID[c.deity];
      items.push({
        type: 'chalisa',
        deity: c.deity,
        titleEnglish: c.titleEnglish,
        titleHindi: c.titleHindi,
        deityLabel: meta?.name ?? c.deity,
      });
    }
    return items;
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    if (!debouncedQuery) return [];
    const q = debouncedQuery.toLowerCase();
    const matched = corpus.filter(item =>
      item.titleEnglish.toLowerCase().includes(q) ||
      item.titleHindi.includes(debouncedQuery) ||
      item.deity.toLowerCase().includes(q) ||
      item.deityLabel.toLowerCase().includes(q)
    );
    matched.sort((a, b) => {
      if (a.deity !== b.deity) return a.deity.localeCompare(b.deity);
      return a.titleEnglish.localeCompare(b.titleEnglish);
    });
    if (selectedDeities.length > 0) {
      const prefer = new Set(selectedDeities);
      matched.sort((a, b) => {
        const aPref = prefer.has(a.deity) ? 0 : 1;
        const bPref = prefer.has(b.deity) ? 0 : 1;
        return aPref - bPref;
      });
    }
    return matched;
  }, [corpus, debouncedQuery, selectedDeities]);

  const sections: ResultSection[] = useMemo(() => {
    const aartis = results.filter(r => r.type === 'aarti');
    const chalisas = results.filter(r => r.type === 'chalisa');
    const out: ResultSection[] = [];
    if (aartis.length > 0) {
      out.push({ type: 'aarti', title: t('search.aartisSection', { count: aartis.length }), data: aartis });
    }
    if (chalisas.length > 0) {
      out.push({ type: 'chalisa', title: t('search.chalisasSection', { count: chalisas.length }), data: chalisas });
    }
    return out;
  }, [results, t]);

  const hasQuery = query.trim().length > 0;
  const hasResults = results.length > 0;

  const renderItem = useCallback(({ item }: { item: SearchResult }) => {
    const route = item.type === 'aarti' ? `/aarti/${item.deity}` : `/chalisa/${item.deity}`;
    return (
      <ResultCard
        item={item}
        query={query}
        colors={colors}
        onPress={() => router.push(route as any)}
      />
    );
  }, [query, colors]);

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <View style={[styles.searchBar, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="search" size={16} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.textPrimary, fontFamily: 'Fraunces_400Regular_Italic' }]}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {hasQuery && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.clearSearch')}>
              <Icon name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Results / States ─────────────────────────────────────────── */}
      {!hasQuery ? (
        <EmptyPrompt colors={colors} />
      ) : !hasResults ? (
        <NoResults query={query} colors={colors} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.type}-${item.deity}`}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.base }]}>
              <Kicker
                color={colors.accent}
                size={10}
                withTrailingRule
                ruleColor={colors.divider}
                wrapperStyle={styles.sectionHeaderRow}>
                {section.title}
              </Kicker>
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
        />
      )}

    </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────

interface ResultCardProps {
  item: SearchResult;
  query: string;
  colors: ColorPalette;
  onPress: () => void;
}

const ResultCard = memo(function ResultCard({ item, query, colors, onPress }: ResultCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.titleEnglish} — ${item.deityLabel}`}>
      <DeityAvatar deity={item.deity} size={44} />
      <View style={styles.cardText}>
        <HighlightText
          text={item.titleHindi}
          query={query}
          variant="deva-bold"
          baseStyle={[styles.cardNative, { color: colors.textPrimary }]}
          highlightColor={colors.accent}
        />
        <HighlightText
          text={item.titleEnglish}
          query={query}
          variant="body-italic"
          baseStyle={[styles.cardEnglish, { color: colors.textTertiary }]}
          highlightColor={colors.accent}
        />
        <HighlightText
          text={item.deityLabel}
          query={query}
          variant="mono-caps"
          baseStyle={[styles.cardDeity, { color: palette.gold }]}
          highlightColor={colors.accent}
        />
      </View>
      <Icon name="chevron-right" size={14} color={colors.textMuted} />
    </TouchableOpacity>
  );
});

// ─── Highlight Text ───────────────────────────────────────────────────────────

interface HighlightTextProps {
  text: string;
  query: string;
  variant: 'deva-bold' | 'body-italic' | 'mono-caps';
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
      <Ornament variant="lotus" style={styles.emptyOrnament} />
      <Text variant="display-italic" style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        {t('search.emptyTitle')}
      </Text>
      <Text variant="body-italic" style={[styles.emptySub, { color: colors.textTertiary }]}>
        {t('search.emptyDesc')}
      </Text>
    </View>
  );
}

function NoResults({ query, colors }: { query: string; colors: ColorPalette }) {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <Ornament variant="lotus" style={styles.emptyOrnament} />
      <Text variant="display-italic" style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        {t('search.noResults')}
      </Text>
      <Text variant="body-italic" style={[styles.emptySub, { color: colors.textTertiary }]}>
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
    gap: 10,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: borderRadius.button,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
    padding: 0,
    margin: 0,
  },

  // Results
  results: { paddingTop: 10, paddingBottom: 32 },

  // Section header
  sectionHeaderWrap: { paddingTop: 14, paddingBottom: 10 },
  sectionHeaderRow: { marginBottom: 0 },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPad,
    marginBottom: 10,
  },
  cardText: { flex: 1 },
  cardNative: { fontSize: 16, lineHeight: 22, marginBottom: 2 },
  cardEnglish: { fontSize: 12, lineHeight: 16, marginBottom: 4 },
  cardDeity: { fontSize: 9 },

  // Empty states
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 40 },
  emptyOrnament: { width: 140, marginBottom: 8 },
  emptyTitle: { fontSize: 26 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
