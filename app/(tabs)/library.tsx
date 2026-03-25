import { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { AdBanner } from '@/components/common/AdBanner';
import type { IAarti, IChalisaSection } from '@/types';

// ─── Row / Item Types ─────────────────────────────────────────────────────────

interface AartiRow {
  id: string;
  titleEnglish: string;
  titleNative: string;
  content: string;
  deity: string;
}

interface ChalisaRow {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
  sections: string;
}

interface ChalisaItem {
  id: string;
  titleEnglish: string;
  titleNative: string;
  deity: string;
  sections: IChalisaSection[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEITIES = ['All', 'Ganesh', 'Shiva', 'Lakshmi', 'Vishnu', 'Hanuman'] as const;
type DeityFilter = (typeof DEITIES)[number];
type ActiveTab = 'aartis' | 'chalisas';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToAarti(row: AartiRow): IAarti {
  return { ...row, content: JSON.parse(row.content) as string[] };
}

function rowToChalisa(row: ChalisaRow): ChalisaItem {
  return { ...row, sections: JSON.parse(row.sections) as IChalisaSection[] };
}

function countChaupais(sections: IChalisaSection[]): number {
  return sections.filter((s) => s.type === 'chaupai').length;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const { isDarkMode, favoriteIds, toggleFavorite } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();

  const [activeTab, setActiveTab] = useState<ActiveTab>('aartis');
  const [activeDeity, setActiveDeity] = useState<DeityFilter>('All');
  const [aartis, setAartis] = useState<IAarti[]>([]);
  const [chalisas, setChalisas] = useState<ChalisaItem[]>([]);

  // ── Load data whenever tab or deity filter changes ─────────────────────────
  useEffect(() => {
    if (activeTab === 'aartis') {
      const rows =
        activeDeity === 'All'
          ? db.getAllSync<AartiRow>('SELECT * FROM aartis ORDER BY deity, titleEnglish')
          : db.getAllSync<AartiRow>(
              'SELECT * FROM aartis WHERE deity = ? ORDER BY titleEnglish',
              [activeDeity]
            );
      setAartis(rows.map(rowToAarti));
    } else {
      const rows =
        activeDeity === 'All'
          ? db.getAllSync<ChalisaRow>('SELECT * FROM chalisas ORDER BY deity, titleEnglish')
          : db.getAllSync<ChalisaRow>(
              'SELECT * FROM chalisas WHERE deity = ? ORDER BY titleEnglish',
              [activeDeity]
            );
      setChalisas(rows.map(rowToChalisa));
    }
  }, [db, activeTab, activeDeity]);

  // ── Render callbacks ────────────────────────────────────────────────────────
  const renderAarti = useCallback(
    ({ item }: ListRenderItemInfo<IAarti>) => (
      <AartiCard
        item={item}
        colors={colors}
        isFavorite={favoriteIds.includes(`aarti-${item.id}`)}
        onToggleFavorite={() => toggleFavorite(`aarti-${item.id}`)}
        onPress={() => router.push(`/aarti/${item.id}`)}
      />
    ),
    [colors, favoriteIds, toggleFavorite]
  );

  const renderChalisa = useCallback(
    ({ item }: ListRenderItemInfo<ChalisaItem>) => (
      <ChalisaCard
        item={item}
        colors={colors}
        isFavorite={favoriteIds.includes(`chalisa-${item.id}`)}
        onToggleFavorite={() => toggleFavorite(`chalisa-${item.id}`)}
        onPress={() => router.push(`/chalisa/${item.id}`)}
      />
    ),
    [colors, favoriteIds, toggleFavorite]
  );

  const isAartiTab = activeTab === 'aartis';

  const listContentStyle = [styles.listContent, { paddingHorizontal: spacing.screenH }];
  const emptyText = isAartiTab ? 'No aartis found' : 'No chalisas found';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>भजन संग्रह</Text>
          <Text style={[styles.screenTitleEn, { color: colors.textMuted }]}>Library</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/search')}
          style={[styles.searchBtn, { backgroundColor: colors.surfaceRecessed }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Segment Control ───────────────────────────────────────────── */}
      <View style={[styles.segmentWrap, { paddingHorizontal: spacing.screenH }]}>
        <View style={[styles.segmentContainer, { backgroundColor: colors.surfaceRecessed }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('aartis')}
            style={[styles.segmentBtn, isAartiTab && { backgroundColor: colors.accent }]}>
            <Text
              style={[
                styles.segmentText,
                { color: isAartiTab ? '#FFFFFF' : colors.textSecondary },
              ]}>
              Aartis
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('chalisas')}
            style={[styles.segmentBtn, !isAartiTab && { backgroundColor: colors.accent }]}>
            <Text
              style={[
                styles.segmentText,
                { color: !isAartiTab ? '#FFFFFF' : colors.textSecondary },
              ]}>
              Chalisas
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Deity Filter Chips ────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsRow}
        contentContainerStyle={[styles.chipsScroll, { paddingHorizontal: spacing.screenH }]}>
        {DEITIES.map((deity) => {
          const isActive = activeDeity === deity;
          return (
            <TouchableOpacity
              key={deity}
              activeOpacity={0.8}
              onPress={() => setActiveDeity(deity)}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? colors.accent : colors.surfaceRecessed,
                  borderColor: isActive ? colors.accent : colors.border,
                },
              ]}>
              <Text style={[styles.chipText, { color: isActive ? '#FFFFFF' : colors.textSecondary }]}>
                {deity}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List ──────────────────────────────────────────────────────── */}
      {isAartiTab ? (
        <FlatList
          data={aartis}
          keyExtractor={(item) => item.id}
          renderItem={renderAarti}
          contentContainerStyle={listContentStyle}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.gridGap }} />}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{emptyText}</Text>
          }
        />
      ) : (
        <FlatList
          data={chalisas}
          keyExtractor={(item) => item.id}
          renderItem={renderChalisa}
          contentContainerStyle={listContentStyle}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.gridGap }} />}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{emptyText}</Text>
          }
        />
      )}

      <AdBanner colors={colors} />

    </SafeAreaView>
  );
}

// ─── Aarti Card ───────────────────────────────────────────────────────────────

interface AartiCardProps {
  item: IAarti;
  colors: ColorPalette;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPress: () => void;
}

function AartiCard({ item, colors, isFavorite, onToggleFavorite, onPress }: AartiCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <DeityAvatar deity={item.deity} size={46} />
      <View style={styles.cardText}>
        <Text style={[styles.cardTitleNative, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.titleNative}
        </Text>
        <Text style={[styles.cardTitleEn, { color: colors.textTertiary }]} numberOfLines={1}>
          {item.titleEnglish}
        </Text>
        <View style={[styles.badge, { backgroundColor: colors.surfaceRecessed }]}>
          <Text style={[styles.badgeText, { color: colors.accent }]}>{item.deity}</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={onToggleFavorite}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={22}
          color={isFavorite ? colors.accent : colors.textMuted}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Chalisa Card ─────────────────────────────────────────────────────────────

interface ChalisaCardProps {
  item: ChalisaItem;
  colors: ColorPalette;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPress: () => void;
}

function ChalisaCard({ item, colors, isFavorite, onToggleFavorite, onPress }: ChalisaCardProps) {
  const chaupaiCount = countChaupais(item.sections);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <DeityAvatar deity={item.deity} size={46} />
      <View style={styles.cardText}>
        <Text style={[styles.cardTitleNative, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.titleNative}
        </Text>
        <Text style={[styles.cardTitleEn, { color: colors.textTertiary }]} numberOfLines={1}>
          {item.titleEnglish}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.surfaceRecessed }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>{item.deity}</Text>
          </View>
          {chaupaiCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.borderAccent }]}>
              <Text style={[styles.badgeText, { color: colors.accent }]}>
                {chaupaiCount} चौपाई
              </Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity
        onPress={onToggleFavorite}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={22}
          color={isFavorite ? colors.accent : colors.textMuted}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
  },
  screenTitle: { fontSize: 22, fontFamily: 'Mukta_700Bold', lineHeight: 28 },
  screenTitleEn: { fontSize: 12, fontFamily: 'Mukta_400Regular', letterSpacing: 0.5, marginTop: 1 },
  searchBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  // Segment
  segmentWrap: { marginBottom: 14 },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: borderRadius.button,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: borderRadius.button - 2,
    alignItems: 'center',
  },
  segmentText: { fontSize: 14, fontFamily: 'Mukta_500Medium' },

  // Chips
  chipsRow: { maxHeight: 44, marginBottom: 14 },
  chipsScroll: { gap: 8, alignItems: 'center', paddingRight: spacing.screenH },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: 'Mukta_400Regular' },

  // List
  listContent: { paddingTop: 2, paddingBottom: 32 },
  emptyText: {
    textAlign: 'center',
    fontFamily: 'Mukta_400Regular',
    fontSize: 15,
    marginTop: 48,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPad,
  },
  cardText: { flex: 1 },
  cardTitleNative: { fontSize: 16, fontFamily: 'Mukta_700Bold', marginBottom: 2 },
  cardTitleEn: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginBottom: 6 },

  // Badges
  badgeRow: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.chip },
  badgeText: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 0.3 },
});
