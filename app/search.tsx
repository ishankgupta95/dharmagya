import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';
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

export default function SearchScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const selectedDeities = useStore(s => s.selectedDeities);
  const colors = isDarkMode ? darkColors : lightColors;
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // All searchable items, computed once. ~38 items total (19 aartis + 19 chalisas).
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
      // Stable sort: alphabetical by deity, then title; matches whose deity is
      // in the user's selectedDeities float to the top.
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

  const hasQuery = query.trim().length > 0;
  const hasResults = results.length > 0;

  const renderItem = useCallback(({ item }: ListRenderItemInfo<SearchResult>) => {
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
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      {/* ── Search Bar ────────────────────────────────────────────────── */}
      <View style={[styles.searchBar, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={[styles.inputWrap, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.textPrimary }]}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {hasQuery && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Results / States ──────────────────────────────────────────── */}
      {!hasQuery ? (
        <EmptyPrompt colors={colors} />
      ) : !hasResults ? (
        <NoResults query={query} colors={colors} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.type}-${item.deity}`}
          renderItem={renderItem}
          contentContainerStyle={[styles.results, { paddingHorizontal: spacing.screenH }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}

    </SafeAreaView>
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
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <DeityAvatar deity={item.deity} size={44} />
      <View style={styles.cardText}>
        <HighlightText
          text={item.titleHindi}
          query={query}
          baseStyle={[styles.cardNative, { color: colors.textPrimary }]}
          highlightColor={colors.accent}
        />
        <HighlightText
          text={item.titleEnglish}
          query={query}
          baseStyle={[styles.cardEnglish, { color: colors.textTertiary }]}
          highlightColor={colors.accent}
        />
        <HighlightText
          text={item.deityLabel}
          query={query}
          baseStyle={[styles.cardDeity, { color: colors.textMuted }]}
          highlightColor={colors.accent}
        />
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
});

// ─── Highlight Text ───────────────────────────────────────────────────────────

interface HighlightTextProps {
  text: string;
  query: string;
  baseStyle: object | object[];
  highlightColor: string;
}

const HighlightText = memo(function HighlightText({ text, query, baseStyle, highlightColor }: HighlightTextProps) {
  const q = query.trim();
  if (!q) return <Text style={baseStyle}>{text}</Text>;

  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1) return <Text style={baseStyle}>{text}</Text>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);

  return (
    <Text style={baseStyle}>
      {before}
      <Text style={[{ color: highlightColor, fontFamily: 'Mukta_700Bold' }]}>{match}</Text>
      {after}
    </Text>
  );
});

// ─── Empty States ─────────────────────────────────────────────────────────────

function EmptyPrompt({ colors }: { colors: ColorPalette }) {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>🔍</Text>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('search.emptyTitle')}</Text>
      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
        {t('search.emptyDesc')}
      </Text>
    </View>
  );
}

function NoResults({ query, colors }: { query: string; colors: ColorPalette }) {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>🙏</Text>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('search.noResults')}</Text>
      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
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
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: borderRadius.button,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Mukta_400Regular',
    padding: 0,
    margin: 0,
  },

  // Results
  results: { paddingTop: 16, paddingBottom: 32 },

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
  cardNative: { fontSize: 16, fontFamily: 'Mukta_700Bold', marginBottom: 2 },
  cardEnglish: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginBottom: 2 },
  cardDeity: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.3 },

  // Empty states
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontFamily: 'Mukta_500Medium' },
  emptySub: { fontSize: 14, fontFamily: 'Mukta_400Regular', textAlign: 'center', lineHeight: 22 },
});
