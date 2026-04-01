import { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
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
import { ALL_DEITIES, type DeityMeta } from '@/config/deities';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeityCount {
  deity: string;
  count: number;
}

interface DeityCardData extends DeityMeta {
  aartiCount: number;
  chalisaCount: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const NUM_COLUMNS = 3;
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.screenH * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function GodsScreen() {
  const { isDarkMode } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();

  const [deities, setDeities] = useState<DeityCardData[]>([]);

  useEffect(() => {
    const aartiCounts = db.getAllSync<DeityCount>(
      'SELECT deity, COUNT(*) as count FROM aartis GROUP BY deity'
    );
    const chalisaCounts = db.getAllSync<DeityCount>(
      'SELECT deity, COUNT(*) as count FROM chalisas GROUP BY deity'
    );

    const aartiMap = Object.fromEntries(aartiCounts.map(r => [r.deity, r.count]));
    const chalisaMap = Object.fromEntries(chalisaCounts.map(r => [r.deity, r.count]));

    const data: DeityCardData[] = ALL_DEITIES.map(d => ({
      ...d,
      aartiCount: aartiMap[d.name] ?? 0,
      chalisaCount: chalisaMap[d.name] ?? 0,
    }));

    setDeities(data);
  }, [db]);

  const renderDeity = useCallback(
    ({ item }: ListRenderItemInfo<DeityCardData>) => (
      <DeityCard deity={item} colors={colors} />
    ),
    [colors]
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>देवी देवता</Text>
          <Text style={[styles.screenTitleEn, { color: colors.textMuted }]}>Gods</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/search')}
          style={[styles.searchBtn, { backgroundColor: colors.surfaceRecessed }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── God Grid ──────────────────────────────────────────────────── */}
      <FlatList
        data={deities}
        keyExtractor={(item) => item.id}
        renderItem={renderDeity}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={[styles.gridContent, { paddingHorizontal: spacing.screenH }]}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
      />

      <AdBanner colors={colors} />

    </SafeAreaView>
  );
}

// ─── Deity Card ──────────────────────────────────────────────────────────────

interface DeityCardProps {
  deity: DeityCardData;
  colors: ColorPalette;
}

function DeityCard({ deity, colors }: DeityCardProps) {
  const totalCount = deity.aartiCount + deity.chalisaCount;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(`/god/${deity.id}`)}
      style={[
        styles.card,
        {
          width: CARD_WIDTH,
          backgroundColor: colors.surface,
          borderColor: deity.color + '30',
        },
      ]}>
      <DeityAvatar deity={deity.name} size={56} />
      <Text style={[styles.cardNameHindi, { color: colors.textPrimary }]} numberOfLines={1}>
        {deity.nameHindi}
      </Text>
      <Text style={[styles.cardName, { color: colors.textSecondary }]} numberOfLines={1}>
        {deity.name}
      </Text>
      {totalCount > 0 && (
        <View style={[styles.countBadge, { backgroundColor: deity.color + '18' }]}>
          <Text style={[styles.countText, { color: deity.color }]}>
            {totalCount} {totalCount === 1 ? 'भजन' : 'भजन'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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

  // Grid
  gridContent: { paddingTop: 4, paddingBottom: 32 },
  gridRow: { gap: CARD_GAP, marginBottom: CARD_GAP },

  // Card
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 4,
  },
  cardNameHindi: { fontSize: 15, fontFamily: 'Mukta_500Medium', marginTop: 4 },
  cardName: { fontSize: 11, fontFamily: 'Mukta_400Regular' },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.chip,
    marginTop: 4,
  },
  countText: { fontSize: 10, fontFamily: 'Mukta_400Regular' },
});
