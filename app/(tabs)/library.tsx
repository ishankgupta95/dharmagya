import { useCallback, memo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ListRenderItemInfo,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { getDeityImage } from '@/config/deityImages';
import { AdBanner } from '@/components/common/AdBanner';
import { ALL_DEITIES, type DeityMeta } from '@/config/deities';

// ─── Types ───────────────────────────────────────────────────────────────────

type DeityCardData = DeityMeta;

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function GodsScreen() {
  const { isDarkMode } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;
  const deities: DeityCardData[] = ALL_DEITIES;

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

      {/* ── God List ─────────────────────────────────────────────────── */}
      <FlatList
        data={deities}
        keyExtractor={(item) => item.id}
        renderItem={renderDeity}
        getItemLayout={(_, index) => ({ length: 98, offset: 98 * index, index })}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.screenH }]}
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

const DeityCard = memo(function DeityCard({ deity, colors }: DeityCardProps) {
  const image = getDeityImage(deity.name);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/god/${deity.id}`)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: deity.color + '25' }]}>

      {/* ── Portrait ── */}
      <View style={[styles.imageBox, { backgroundColor: deity.color + '15' }]}>
        {image ? (
          <Image source={image} style={styles.image} resizeMode="cover" />
        ) : (
          <DeityAvatar deity={deity.name} size={72} />
        )}
      </View>

      {/* ── Info ── */}
      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>
          {deity.displayName}
        </Text>
        <Text style={[styles.cardDesc, { color: colors.textMuted }]} numberOfLines={1}>
          {deity.description}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginRight: 4 }} />
    </TouchableOpacity>
  );
});

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

  // List
  listContent: { paddingTop: 4, paddingBottom: 32, gap: 10 },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageBox: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 88,
    height: 88,
  },
  cardInfo: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  cardName: { fontSize: 16, fontFamily: 'Mukta_600SemiBold', lineHeight: 22 },
  cardDesc: { fontSize: 12, fontFamily: 'Mukta_400Regular', lineHeight: 16 },
});
