import { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  type: 'aarti' | 'chalisa' | 'katha';
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const { isDarkMode } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [aartiResults, setAartiResults] = useState<SearchResult[]>([]);
  const [chalisaResults, setChalisaResults] = useState<SearchResult[]>([]);
  const [kathaResults, setKathaResults] = useState<SearchResult[]>([]);

  // Auto-focus on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  // Debounced DB query (300ms) to avoid jank on every keystroke
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setAartiResults([]);
      setChalisaResults([]);
      setKathaResults([]);
      return;
    }

    const timer = setTimeout(() => {
      const like = `%${q}%`;

      const aartiRows = db.getAllSync<Omit<SearchResult, 'type'>>(
        'SELECT id, titleEnglish, titleNative, deity FROM aartis WHERE titleEnglish LIKE ? OR titleNative LIKE ? OR deity LIKE ? ORDER BY deity, titleEnglish',
        [like, like, like]
      );
      setAartiResults(aartiRows.map((r) => ({ ...r, type: 'aarti' as const })));

      const chalisaRows = db.getAllSync<Omit<SearchResult, 'type'>>(
        'SELECT id, titleEnglish, titleNative, deity FROM chalisas WHERE titleEnglish LIKE ? OR titleNative LIKE ? OR deity LIKE ? ORDER BY deity, titleEnglish',
        [like, like, like]
      );
      setChalisaResults(chalisaRows.map((r) => ({ ...r, type: 'chalisa' as const })));

      const kathaRows = db.getAllSync<Omit<SearchResult, 'type'>>(
        'SELECT id, titleEnglish, titleNative, deity FROM kathas WHERE titleEnglish LIKE ? OR titleNative LIKE ? OR deity LIKE ? ORDER BY deity, titleEnglish',
        [like, like, like]
      );
      setKathaResults(kathaRows.map((r) => ({ ...r, type: 'katha' as const })));
    }, 300);

    return () => clearTimeout(timer);
  }, [db, query]);

  const hasQuery = query.trim().length > 0;
  const hasResults = aartiResults.length > 0 || chalisaResults.length > 0 || kathaResults.length > 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>

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
            placeholder="Search aartis, chalisas, kathas…"
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
        <ScrollView
          contentContainerStyle={[styles.results, { paddingHorizontal: spacing.screenH }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Aartis group */}
          {aartiResults.length > 0 && (
            <View>
              <GroupHeader label={`AARTIS  ·  ${aartiResults.length}`} colors={colors} />
              {aartiResults.map((item) => (
                <ResultCard
                  key={item.id}
                  item={item}
                  query={query}
                  colors={colors}
                  onPress={() => router.push(`/aarti/${item.id}`)}
                />
              ))}
            </View>
          )}

          {/* Chalisas group */}
          {chalisaResults.length > 0 && (
            <View style={aartiResults.length > 0 ? { marginTop: 8 } : undefined}>
              <GroupHeader label={`CHALISAS  ·  ${chalisaResults.length}`} colors={colors} />
              {chalisaResults.map((item) => (
                <ResultCard
                  key={item.id}
                  item={item}
                  query={query}
                  colors={colors}
                  onPress={() => router.push(`/chalisa/${item.id}`)}
                />
              ))}
            </View>
          )}

          {/* Kathas group */}
          {kathaResults.length > 0 && (
            <View style={(aartiResults.length > 0 || chalisaResults.length > 0) ? { marginTop: 8 } : undefined}>
              <GroupHeader label={`KATHAS  ·  ${kathaResults.length}`} colors={colors} />
              {kathaResults.map((item) => (
                <ResultCard
                  key={item.id}
                  item={item}
                  query={query}
                  colors={colors}
                  onPress={() => router.push(`/katha/${item.id}`)}
                />
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
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

function ResultCard({ item, query, colors, onPress }: ResultCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <DeityAvatar deity={item.deity} size={44} />
      <View style={styles.cardText}>
        <HighlightText
          text={item.titleNative}
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
          text={item.deity}
          query={query}
          baseStyle={[styles.cardDeity, { color: colors.textMuted }]}
          highlightColor={colors.accent}
        />
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── Highlight Text ───────────────────────────────────────────────────────────

interface HighlightTextProps {
  text: string;
  query: string;
  baseStyle: object | object[];
  highlightColor: string;
}

function HighlightText({ text, query, baseStyle, highlightColor }: HighlightTextProps) {
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
}

// ─── Group Header ─────────────────────────────────────────────────────────────

function GroupHeader({ label, colors }: { label: string; colors: ColorPalette }) {
  return (
    <Text style={[styles.groupHeader, { color: colors.textMuted }]}>{label}</Text>
  );
}

// ─── Empty States ─────────────────────────────────────────────────────────────

function EmptyPrompt({ colors }: { colors: ColorPalette }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>🔍</Text>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>खोज करें</Text>
      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
        Search by title, transliteration, or deity name
      </Text>
    </View>
  );
}

function NoResults({ query, colors }: { query: string; colors: ColorPalette }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>🙏</Text>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No results</Text>
      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
        Nothing found for "{query}"
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
  groupHeader: {
    fontSize: 11,
    fontFamily: 'Mukta_400Regular',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },

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
