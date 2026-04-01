import { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { DEITY_BY_ID } from '@/config/deities';
import type { IAarti, IChalisaSection } from '@/types';

// ─── Row / Item Types ────────────────────────────────────────────────────────

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

type ActiveTab = 'aartis' | 'chalisas';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToAarti(row: AartiRow): IAarti {
  return { ...row, content: JSON.parse(row.content) as string[] };
}

function rowToChalisa(row: ChalisaRow): ChalisaItem {
  return { ...row, sections: JSON.parse(row.sections) as IChalisaSection[] };
}

function countChaupais(sections: IChalisaSection[]): number {
  return sections.filter((s) => s.type === 'chaupai').length;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function GodDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDarkMode, favoriteIds, toggleFavorite } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();

  const deity = DEITY_BY_ID[id ?? ''];

  const [activeTab, setActiveTab] = useState<ActiveTab>('aartis');
  const [aartis, setAartis] = useState<IAarti[]>([]);
  const [chalisas, setChalisas] = useState<ChalisaItem[]>([]);

  useEffect(() => {
    if (!deity) return;
    const aartiRows = db.getAllSync<AartiRow>(
      'SELECT * FROM aartis WHERE deity = ? ORDER BY titleEnglish',
      [deity.name]
    );
    setAartis(aartiRows.map(rowToAarti));

    const chalisaRows = db.getAllSync<ChalisaRow>(
      'SELECT * FROM chalisas WHERE deity = ? ORDER BY titleEnglish',
      [deity.name]
    );
    setChalisas(chalisaRows.map(rowToChalisa));
  }, [db, deity]);

  // Auto-switch to chalisas tab if no aartis but chalisas exist
  useEffect(() => {
    if (aartis.length === 0 && chalisas.length > 0) {
      setActiveTab('chalisas');
    }
  }, [aartis.length, chalisas.length]);

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

  if (!deity) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Deity not found</Text>
      </SafeAreaView>
    );
  }

  const isAartiTab = activeTab === 'aartis';
  const headerGradient: readonly [string, string] = [deity.color + '30', colors.base];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <LinearGradient colors={headerGradient} style={styles.header}>
        <View style={[styles.headerNav, { paddingHorizontal: spacing.screenH }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.navBtn, { backgroundColor: 'rgba(0,0,0,0.25)' }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerContent}>
          <DeityAvatar deity={deity.name} size={72} />
          <Text style={[styles.headerNameHindi, { color: colors.textPrimary }]}>
            {deity.nameHindi}
          </Text>
          <Text style={[styles.headerName, { color: colors.textSecondary }]}>
            {deity.name}
          </Text>
          <Text style={[styles.headerDesc, { color: colors.textMuted }]}>
            {deity.description}
          </Text>
        </View>
      </LinearGradient>

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
              Aartis ({aartis.length})
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
              Chalisas ({chalisas.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── List ──────────────────────────────────────────────────────── */}
      {isAartiTab ? (
        <FlatList
          data={aartis}
          keyExtractor={(item) => item.id}
          renderItem={renderAarti}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.gridGap }} />}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No aartis available yet
            </Text>
          }
        />
      ) : (
        <FlatList
          data={chalisas}
          keyExtractor={(item) => item.id}
          renderItem={renderChalisa}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.gridGap }} />}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No chalisas available yet
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Aarti Card ──────────────────────────────────────────────────────────────

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
      <View style={styles.cardText}>
        <Text style={[styles.cardTitleNative, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.titleNative}
        </Text>
        <Text style={[styles.cardTitleEn, { color: colors.textTertiary }]} numberOfLines={1}>
          {item.titleEnglish}
        </Text>
        <View style={[styles.badge, { backgroundColor: colors.borderAccent }]}>
          <Text style={[styles.badgeText, { color: colors.accent }]}>आरती</Text>
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

// ─── Chalisa Card ────────────────────────────────────────────────────────────

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
      <View style={styles.cardText}>
        <Text style={[styles.cardTitleNative, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.titleNative}
        </Text>
        <Text style={[styles.cardTitleEn, { color: colors.textTertiary }]} numberOfLines={1}>
          {item.titleEnglish}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.borderAccent }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>चालीसा</Text>
          </View>
          {chaupaiCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.surfaceRecessed }]}>
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: { paddingBottom: 20 },
  headerNav: { flexDirection: 'row', paddingTop: 8, paddingBottom: 16 },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: { alignItems: 'center', gap: 4 },
  headerNameHindi: { fontSize: 22, fontFamily: 'Mukta_700Bold', marginTop: 8 },
  headerName: { fontSize: 13, fontFamily: 'Mukta_400Regular' },
  headerDesc: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginTop: 2 },

  // Segment
  segmentWrap: { marginVertical: 14 },
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
